import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { HourlyCostService } from '../hourly-cost/hourly-cost.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { User, UserRole } from '@prisma/client';

export interface UserTeamInfo {
  id: string;
  name: string;
}

export interface UserResponse {
  id: string;
  authId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  salary?: number | null; // Only included for admin/owner
  hourlyCost?: number; // Only included for admin/owner
  isActive: boolean;
  role: UserRole;
  relation: string;
  nif: string | null;
  naf: string | null;
  team: UserTeamInfo | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface FindAllOptions {
  userIds?: string[] | null;
  isFullAdmin?: boolean;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly hourlyCostService: HourlyCostService,
  ) {}

  async findAll(
    companyId: string,
    options?: FindAllOptions,
  ): Promise<UserResponse[]> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          companyId,
          deletedAt: null,
          // Filter by userIds if provided (for team scope)
          ...(options?.userIds && { id: { in: options.userIds } }),
        },
        include: {
          team: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      const isFullAdmin = options?.isFullAdmin ?? true;
      return users.map((user) => this.toUserResponse(user, isFullAdmin));
    } catch (error) {
      this.logger.error(
        `Error al obtener usuarios de la empresa ${companyId}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'Error al obtener la lista de usuarios',
      );
    }
  }

  async findOne(
    id: string,
    companyId: string,
    isFullAdmin: boolean = true,
  ): Promise<UserResponse> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id,
          companyId,
          deletedAt: null,
        },
        include: {
          team: {
            select: { id: true, name: true },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      return this.toUserResponse(user, isFullAdmin);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error al obtener usuario ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Error al obtener el usuario');
    }
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    companyId: string,
    requestingUser: { sub: string; role: string },
  ): Promise<UserResponse> {
    let existing: User | null = null;
    let emailChanged = false;
    let supabaseEmailUpdated = false;

    // Check if requester is a full admin (OWNER/ADMIN)
    const isFullAdmin = ['OWNER', 'ADMIN'].includes(requestingUser.role);

    try {
      existing = await this.prisma.user.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Prevent self-role change
      if (
        id === requestingUser.sub &&
        updateUserDto.role !== undefined &&
        (updateUserDto.role as string) !== (existing.role as string)
      ) {
        throw new ForbiddenException('No puedes cambiar tu propio rol');
      }

      // Only OWNER/ADMIN can edit OWNER users
      if (
        existing.role === 'OWNER' &&
        !['OWNER', 'ADMIN'].includes(requestingUser.role)
      ) {
        throw new ForbiddenException(
          'Solo los administradores pueden editar al propietario',
        );
      }

      // Only OWNER/ADMIN can edit ADMIN users
      if (
        existing.role === 'ADMIN' &&
        !['OWNER', 'ADMIN'].includes(requestingUser.role)
      ) {
        throw new ForbiddenException(
          'Solo los administradores pueden editar a otros administradores',
        );
      }

      // Determine final role and teamId after update
      const finalRole = (updateUserDto.role ?? existing.role) as string;
      const finalTeamId =
        updateUserDto.teamId !== undefined
          ? updateUserDto.teamId
          : existing.teamId;

      // Validate TEAM_LEADER must have a team assigned
      if (finalRole === 'TEAM_LEADER' && !finalTeamId) {
        throw new BadRequestException(
          'Un líder de equipo debe tener un equipo asignado',
        );
      }

      // If demoting an OWNER, ensure at least one other owner remains
      if (existing.role === 'OWNER' && finalRole !== 'OWNER') {
        const ownerCount = await this.prisma.user.count({
          where: {
            companyId,
            role: 'OWNER',
            deletedAt: null,
            id: { not: id },
          },
        });
        if (ownerCount === 0) {
          throw new ForbiddenException(
            'Debe haber al menos un propietario en la empresa',
          );
        }
      }

      emailChanged =
        Boolean(updateUserDto.email) && updateUserDto.email !== existing.email;

      if (emailChanged) {
        const emailExists = await this.prisma.user.findFirst({
          where: {
            email: updateUserDto.email,
            companyId,
            id: { not: id },
          },
        });

        if (emailExists) {
          throw new ConflictException(
            `El email ${updateUserDto.email} ya está en uso`,
          );
        }
      }

      if (emailChanged) {
        await this.supabaseService.updateUser(existing.authId, {
          email: updateUserDto.email,
        });
        supabaseEmailUpdated = true;

        // Update email for all users with the same authId (multitenancy)
        await this.prisma.user.updateMany({
          where: { authId: existing.authId },
          data: { email: updateUserDto.email },
        });
      }

      // Team leaders cannot modify salary or hourlyCost - ignore these fields
      const effectiveSalary = isFullAdmin ? updateUserDto.salary : undefined;
      const effectiveHourlyCostFromDto = isFullAdmin
        ? updateUserDto.hourlyCost
        : undefined;

      // Calculate hourly cost if salary is being updated (only for admins)
      let calculatedHourlyCost: number | undefined;
      const salaryChanged =
        effectiveSalary !== undefined &&
        effectiveSalary !== Number(existing.salary);

      if (
        salaryChanged &&
        effectiveSalary !== null &&
        effectiveSalary !== undefined
      ) {
        // Auto-calculate hourly cost from salary
        calculatedHourlyCost =
          await this.hourlyCostService.calculateHourlyCostFromSalary(
            companyId,
            id,
            effectiveSalary,
          );
      }

      // Determine final hourly cost:
      // 1. If salary changed to a non-null value, use calculated value
      // 2. If salary changed to null, reset hourly cost to 0
      // 3. If hourlyCost explicitly provided and salary NOT changed, use that (manual override)
      // 4. Otherwise, keep existing
      let finalHourlyCost: number | undefined;

      if (salaryChanged && calculatedHourlyCost !== undefined) {
        // Salary changed to a non-null value - always use calculated value
        finalHourlyCost = calculatedHourlyCost;
      } else if (salaryChanged && effectiveSalary === null) {
        // Salary removed - reset hourly cost to 0
        finalHourlyCost = 0;
      } else if (!salaryChanged && effectiveHourlyCostFromDto !== undefined) {
        // Manual override when salary didn't change
        finalHourlyCost = effectiveHourlyCostFromDto;
      }
      // Otherwise undefined - Prisma won't update the field

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          name: updateUserDto.name,
          email: updateUserDto.email,
          phone: updateUserDto.phone,
          salary: effectiveSalary,
          hourlyCost: finalHourlyCost,
          isActive: updateUserDto.isActive,
          role: updateUserDto.role,
          relation: updateUserDto.relation,
          teamId: updateUserDto.teamId,
        },
        include: {
          team: {
            select: { id: true, name: true },
          },
        },
      });

      return this.toUserResponse(user, isFullAdmin);
    } catch (error) {
      if (emailChanged && supabaseEmailUpdated && existing) {
        try {
          await this.supabaseService.updateUser(existing.authId, {
            email: existing.email,
          });
          // Rollback email for all users with the same authId
          await this.prisma.user.updateMany({
            where: { authId: existing.authId },
            data: { email: existing.email },
          });
        } catch (rollbackError) {
          this.logger.error(
            `Error al revertir email en Supabase para el usuario ${id}`,
            rollbackError instanceof Error
              ? rollbackError.stack
              : rollbackError,
          );
        }
      }

      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Error al actualizar usuario ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Error al actualizar el usuario');
    }
  }

  async delete(
    id: string,
    companyId: string,
    requestingUser: { sub: string; role: string },
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Prevent self-deletion
      if (id === requestingUser.sub) {
        throw new ForbiddenException('No puedes eliminarte a ti mismo');
      }

      // Only OWNER/ADMIN can delete ADMIN users
      if (
        user.role === 'ADMIN' &&
        !['OWNER', 'ADMIN'].includes(requestingUser.role)
      ) {
        throw new ForbiddenException(
          'Solo los administradores pueden eliminar a otros administradores',
        );
      }

      // If deleting an OWNER, ensure at least one other owner remains
      if (user.role === 'OWNER') {
        const ownerCount = await this.prisma.user.count({
          where: {
            companyId,
            role: 'OWNER',
            deletedAt: null,
            id: { not: id },
          },
        });
        if (ownerCount === 0) {
          throw new ForbiddenException(
            'Debe haber al menos un propietario en la empresa',
          );
        }
      }

      // Check if this authId is used by other active users (multitenancy)
      const otherActiveUsers = await this.prisma.user.count({
        where: {
          authId: user.authId,
          id: { not: id },
          deletedAt: null,
          isActive: true,
        },
      });

      // Only delete Supabase auth user if no other active users share this authId
      if (otherActiveUsers === 0) {
        await this.supabaseService.deleteUser(user.authId);
      }

      await this.prisma.activeTimer.deleteMany({
        where: { userId: id },
      });

      await this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(
        `Error al eliminar usuario ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Error al eliminar el usuario');
    }
  }

  private toUserResponse(
    user: User & { team?: { id: string; name: string } | null },
    isFullAdmin: boolean = true,
  ): UserResponse {
    return {
      id: user.id,
      authId: user.authId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      ...(isFullAdmin && { salary: user.salary ? Number(user.salary) : null }),
      ...(isFullAdmin && { hourlyCost: Number(user.hourlyCost) }),
      isActive: user.isActive,
      role: user.role,
      relation: user.relation,
      nif: user.nif,
      naf: user.naf,
      team: user.team ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
