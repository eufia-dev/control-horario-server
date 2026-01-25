import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

@Injectable()
export class TeamScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the user IDs that the current user has permission to access.
   * - OWNER/ADMIN: all company users
   * - TEAM_LEADER: only users in their team
   * - Others: only themselves
   */
  async getUserIdsInScope(user: JwtPayload): Promise<string[] | null> {
    // OWNER and ADMIN have access to all users (return null to indicate no filtering)
    if (user.role === 'OWNER' || user.role === 'ADMIN') {
      return null;
    }

    // TEAM_LEADER: get all users in their team
    if (user.role === 'TEAM_LEADER' && user.teamId) {
      const teamMembers = await this.prisma.user.findMany({
        where: {
          companyId: user.companyId,
          teamId: user.teamId,
          deletedAt: null,
        },
        select: { id: true },
      });
      return teamMembers.map((u) => u.id);
    }

    // Default: only their own ID
    return [user.sub];
  }

  /**
   * Check if the current user has permission to access a specific user.
   * - OWNER/ADMIN: can access any user in their company
   * - TEAM_LEADER: can access users in their team
   * - Others: can only access themselves
   */
  async canAccessUser(
    user: JwtPayload,
    targetUserId: string,
  ): Promise<boolean> {
    // OWNER and ADMIN have access to all users
    if (user.role === 'OWNER' || user.role === 'ADMIN') {
      return true;
    }

    // Self access is always allowed
    if (user.sub === targetUserId) {
      return true;
    }

    // TEAM_LEADER: check if target user is in their team AND not an admin/owner
    if (user.role === 'TEAM_LEADER' && user.teamId) {
      const targetUser = await this.prisma.user.findFirst({
        where: {
          id: targetUserId,
          companyId: user.companyId,
          teamId: user.teamId,
          deletedAt: null,
          role: { notIn: ['OWNER', 'ADMIN'] },
        },
      });
      return !!targetUser;
    }

    return false;
  }

  /**
   * Check if the current user is a full admin (OWNER or ADMIN).
   */
  isFullAdmin(user: JwtPayload): boolean {
    return user.role === 'OWNER' || user.role === 'ADMIN';
  }

  /**
   * Check if the current user has team leader+ permissions.
   */
  isTeamLeaderOrAbove(user: JwtPayload): boolean {
    return (
      user.role === 'OWNER' ||
      user.role === 'ADMIN' ||
      user.role === 'TEAM_LEADER'
    );
  }
}
