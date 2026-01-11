import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { UpdateTeamDto } from './dto/update-team.dto.js';
import type { Team, UserRole } from '@prisma/client';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface TeamLeaderInfo {
  id: string;
  name: string;
}

export interface TeamResponse {
  id: string;
  name: string;
  memberCount: number;
  leaders: TeamLeaderInfo[];
  createdAt: Date;
}

export interface TeamDetailResponse extends TeamResponse {
  members: TeamMember[];
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string): Promise<TeamResponse[]> {
    const teams = await this.prisma.team.findMany({
      where: { companyId },
      include: {
        members: {
          where: { deletedAt: null },
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return teams.map((team) => this.toTeamResponse(team));
  }

  async findOne(id: string, companyId: string): Promise<TeamDetailResponse> {
    const team = await this.prisma.team.findFirst({
      where: { id, companyId },
      include: {
        members: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    return this.toTeamDetailResponse(team);
  }

  async create(
    dto: CreateTeamDto,
    companyId: string,
  ): Promise<TeamDetailResponse> {
    // Check if team name already exists in this company
    const existing = await this.prisma.team.findFirst({
      where: {
        companyId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un equipo con el nombre "${dto.name}"`,
      );
    }

    // Collect all user IDs to assign to the team
    const leaderIds = dto.leaderIds ?? [];
    const allMemberIds = new Set<string>(dto.memberIds ?? []);
    for (const leaderId of leaderIds) {
      allMemberIds.add(leaderId);
    }

    // Validate all users exist and belong to the company
    if (allMemberIds.size > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: Array.from(allMemberIds) },
          companyId,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });

      const foundIds = new Set(users.map((u) => u.id));
      const missingIds = Array.from(allMemberIds).filter(
        (id) => !foundIds.has(id),
      );

      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Usuarios no encontrados: ${missingIds.join(', ')}`,
        );
      }
    }

    // Create team and assign members in a transaction
    const team = await this.prisma.$transaction(async (tx) => {
      // Create the team
      const newTeam = await tx.team.create({
        data: {
          name: dto.name,
          companyId,
        },
      });

      // Assign members to the team
      if (allMemberIds.size > 0) {
        await tx.user.updateMany({
          where: {
            id: { in: Array.from(allMemberIds) },
            companyId,
          },
          data: { teamId: newTeam.id },
        });
      }

      // Promote all leaders to TEAM_LEADER role
      if (leaderIds.length > 0) {
        await tx.user.updateMany({
          where: {
            id: { in: leaderIds },
            companyId,
          },
          data: { role: 'TEAM_LEADER' },
        });
      }

      // Fetch the team with members
      return tx.team.findUniqueOrThrow({
        where: { id: newTeam.id },
        include: {
          members: {
            where: { deletedAt: null },
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: 'asc' },
          },
        },
      });
    });

    return this.toTeamDetailResponse(team);
  }

  async update(
    id: string,
    dto: UpdateTeamDto,
    companyId: string,
  ): Promise<TeamDetailResponse> {
    const existing = await this.prisma.team.findFirst({
      where: { id, companyId },
      include: {
        members: {
          where: { deletedAt: null },
          select: { id: true, role: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    // Check if new name conflicts with another team
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.team.findFirst({
        where: {
          companyId,
          name: dto.name,
          id: { not: id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Ya existe un equipo con el nombre "${dto.name}"`,
        );
      }
    }

    // Collect all user IDs to assign to the team
    const leaderIds = dto.leaderIds ?? [];
    const newMemberIds = new Set<string>(dto.memberIds ?? []);
    for (const leaderId of leaderIds) {
      newMemberIds.add(leaderId);
    }

    // Validate all users exist and belong to the company
    if (newMemberIds.size > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: Array.from(newMemberIds) },
          companyId,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });

      const foundIds = new Set(users.map((u) => u.id));
      const missingIds = Array.from(newMemberIds).filter(
        (id) => !foundIds.has(id),
      );

      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Usuarios no encontrados: ${missingIds.join(', ')}`,
        );
      }
    }

    // Update team in a transaction
    const team = await this.prisma.$transaction(async (tx) => {
      // Update team name if provided
      if (dto.name) {
        await tx.team.update({
          where: { id },
          data: { name: dto.name },
        });
      }

      // Handle member updates if memberIds or leaderIds are provided
      if (dto.memberIds !== undefined || dto.leaderIds !== undefined) {
        const currentMemberIds = new Set(existing.members.map((m) => m.id));
        const currentLeaderIds = new Set(
          existing.members
            .filter((m) => m.role === 'TEAM_LEADER')
            .map((m) => m.id),
        );

        // Members to remove from team
        const membersToRemove = Array.from(currentMemberIds).filter(
          (memberId) => !newMemberIds.has(memberId),
        );

        // Members to add to team
        const membersToAdd = Array.from(newMemberIds).filter(
          (memberId) => !currentMemberIds.has(memberId),
        );

        // Leaders to demote (were leaders, now not in leaderIds)
        const leadersToDemote = Array.from(currentLeaderIds).filter(
          (leaderId) => !leaderIds.includes(leaderId),
        );

        // Leaders to promote (not leaders before, now in leaderIds)
        const leadersToPromote = leaderIds.filter(
          (leaderId) => !currentLeaderIds.has(leaderId),
        );

        // Remove members from team (and demote if they were TEAM_LEADER)
        if (membersToRemove.length > 0) {
          await tx.user.updateMany({
            where: {
              id: { in: membersToRemove },
              companyId,
            },
            data: { teamId: null, role: 'WORKER' },
          });
        }

        // Add new members to team
        if (membersToAdd.length > 0) {
          await tx.user.updateMany({
            where: {
              id: { in: membersToAdd },
              companyId,
            },
            data: { teamId: id },
          });
        }

        // Demote leaders to WORKER (only those still in the team)
        const leadersToDemoteInTeam = leadersToDemote.filter((lid) =>
          newMemberIds.has(lid),
        );
        if (leadersToDemoteInTeam.length > 0) {
          await tx.user.updateMany({
            where: {
              id: { in: leadersToDemoteInTeam },
              companyId,
            },
            data: { role: 'WORKER' },
          });
        }

        // Promote new leaders to TEAM_LEADER
        if (leadersToPromote.length > 0) {
          await tx.user.updateMany({
            where: {
              id: { in: leadersToPromote },
              companyId,
            },
            data: { role: 'TEAM_LEADER' },
          });
        }
      }

      // Fetch the updated team with members
      return tx.team.findUniqueOrThrow({
        where: { id },
        include: {
          members: {
            where: { deletedAt: null },
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: 'asc' },
          },
        },
      });
    });

    return this.toTeamDetailResponse(team);
  }

  async remove(id: string, companyId: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.team.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    // Remove team from all users and projects, then delete the team
    await this.prisma.$transaction(async (tx) => {
      // Unassign all users from this team
      await tx.user.updateMany({
        where: { teamId: id },
        data: { teamId: null },
      });

      // Unassign all projects from this team
      await tx.project.updateMany({
        where: { teamId: id },
        data: { teamId: null },
      });

      // Delete the team
      await tx.team.delete({
        where: { id },
      });
    });

    return { success: true };
  }

  async addMember(
    teamId: string,
    userId: string,
    companyId: string,
  ): Promise<TeamDetailResponse> {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, companyId },
    });

    if (!team) {
      throw new NotFoundException(`Equipo con ID ${teamId} no encontrado`);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    if (user.teamId === teamId) {
      throw new BadRequestException('El usuario ya es miembro de este equipo');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { teamId },
    });

    return this.findOne(teamId, companyId);
  }

  async removeMember(
    teamId: string,
    userId: string,
    companyId: string,
  ): Promise<TeamDetailResponse> {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, companyId },
    });

    if (!team) {
      throw new NotFoundException(`Equipo con ID ${teamId} no encontrado`);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    if (user.teamId !== teamId) {
      throw new BadRequestException('El usuario no es miembro de este equipo');
    }

    // Cannot remove a TEAM_LEADER from their team - must change role first
    if (user.role === 'TEAM_LEADER') {
      throw new BadRequestException(
        'No se puede quitar a un líder de equipo de su equipo. Primero cambia su rol.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { teamId: null },
    });

    return this.findOne(teamId, companyId);
  }

  // ==================== Team Leader methods ====================

  async getTeamByLeader(
    leaderId: string,
    companyId: string,
  ): Promise<TeamDetailResponse> {
    const leader = await this.prisma.user.findFirst({
      where: { id: leaderId, companyId, deletedAt: null },
      select: { teamId: true, role: true },
    });

    if (!leader) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!leader.teamId) {
      throw new BadRequestException('No perteneces a ningún equipo');
    }

    return this.findOne(leader.teamId, companyId);
  }

  async addMemberByLeader(
    leaderId: string,
    userId: string,
    companyId: string,
  ): Promise<TeamDetailResponse> {
    const leader = await this.prisma.user.findFirst({
      where: { id: leaderId, companyId, deletedAt: null },
      select: { teamId: true, role: true },
    });

    if (!leader) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!leader.teamId) {
      throw new BadRequestException('No perteneces a ningún equipo');
    }

    // Only TEAM_LEADER can add members (ADMIN/OWNER should use the admin endpoint)
    if (leader.role !== 'TEAM_LEADER') {
      throw new BadRequestException(
        'Solo los líderes de equipo pueden usar este endpoint',
      );
    }

    return this.addMember(leader.teamId, userId, companyId);
  }

  async removeMemberByLeader(
    leaderId: string,
    userId: string,
    companyId: string,
  ): Promise<TeamDetailResponse> {
    const leader = await this.prisma.user.findFirst({
      where: { id: leaderId, companyId, deletedAt: null },
      select: { teamId: true, role: true },
    });

    if (!leader) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!leader.teamId) {
      throw new BadRequestException('No perteneces a ningún equipo');
    }

    // Only TEAM_LEADER can remove members (ADMIN/OWNER should use the admin endpoint)
    if (leader.role !== 'TEAM_LEADER') {
      throw new BadRequestException(
        'Solo los líderes de equipo pueden usar este endpoint',
      );
    }

    // A team leader cannot remove themselves
    if (userId === leaderId) {
      throw new BadRequestException('No puedes quitarte a ti mismo del equipo');
    }

    return this.removeMember(leader.teamId, userId, companyId);
  }

  async updateByLeader(
    leaderId: string,
    dto: UpdateTeamDto,
    companyId: string,
  ): Promise<TeamDetailResponse> {
    const leader = await this.prisma.user.findFirst({
      where: { id: leaderId, companyId, deletedAt: null },
      select: { id: true, teamId: true, role: true },
    });

    if (!leader) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!leader.teamId) {
      throw new BadRequestException('No perteneces a ningún equipo');
    }

    // Only TEAM_LEADER can use this endpoint
    if (leader.role !== 'TEAM_LEADER') {
      throw new BadRequestException(
        'Solo los líderes de equipo pueden usar este endpoint',
      );
    }

    // Validate: team leader cannot remove themselves from the team
    // Note: frontend sends leaderIds and memberIds separately - a leader is only in leaderIds, not memberIds
    // The backend merges both lists, so leader is valid if they're in EITHER list
    const inMemberIds = dto.memberIds?.includes(leaderId) ?? false;
    const inLeaderIds = dto.leaderIds?.includes(leaderId) ?? false;
    const memberIdsProvided = dto.memberIds !== undefined;
    const leaderIdsProvided = dto.leaderIds !== undefined;

    // If both lists are provided, leader must be in at least one
    if (
      memberIdsProvided &&
      leaderIdsProvided &&
      !inMemberIds &&
      !inLeaderIds
    ) {
      throw new BadRequestException('No puedes quitarte a ti mismo del equipo');
    }

    // If only memberIds is provided (no leaderIds), leader must be in memberIds
    if (memberIdsProvided && !leaderIdsProvided && !inMemberIds) {
      throw new BadRequestException('No puedes quitarte a ti mismo del equipo');
    }

    // Team leader cannot demote themselves (must remain in leaderIds if provided)
    if (leaderIdsProvided && !inLeaderIds) {
      throw new BadRequestException(
        'No puedes quitarte a ti mismo de la lista de líderes',
      );
    }

    return this.update(leader.teamId, dto, companyId);
  }

  private toTeamResponse(
    team: Team & {
      members: { id: string; name: string; role: UserRole }[];
    },
  ): TeamResponse {
    const leaders = team.members
      .filter((m) => m.role === 'TEAM_LEADER')
      .map((m) => ({ id: m.id, name: m.name }));

    return {
      id: team.id,
      name: team.name,
      memberCount: team.members.length,
      leaders,
      createdAt: team.createdAt,
    };
  }

  private toTeamDetailResponse(
    team: Team & {
      members: { id: string; name: string; email: string; role: UserRole }[];
    },
  ): TeamDetailResponse {
    const leaders = team.members
      .filter((m) => m.role === 'TEAM_LEADER')
      .map((m) => ({ id: m.id, name: m.name }));

    return {
      id: team.id,
      name: team.name,
      memberCount: team.members.length,
      leaders,
      createdAt: team.createdAt,
      members: team.members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
      })),
    };
  }
}
