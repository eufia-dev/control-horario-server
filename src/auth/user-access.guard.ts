import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { TeamScopeService } from './team-scope.service.js';
import {
  CHECK_USER_ACCESS_KEY,
  CheckUserAccessOptions,
} from './decorators/check-user-access.decorator.js';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

/**
 * Guard that validates user access based on the @CheckUserAccess() decorator.
 * Must be used after JwtAuthGuard to ensure req.user is populated.
 *
 * This guard:
 * - Checks if the current user has permission to access the target user
 * - Supports customizable param names for flexibility
 * - Optionally allows team leaders to view any user (for read endpoints)
 */
@Injectable()
export class UserAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly teamScopeService: TeamScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<CheckUserAccessOptions>(
      CHECK_USER_ACCESS_KEY,
      context.getHandler(),
    );

    // If no @CheckUserAccess decorator, skip this guard
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Get the target user ID based on source option
    const paramName = options.paramName || 'id';
    const targetUserId = this.extractUserId(request, paramName, options.source);

    // If no user ID found, nothing to check
    if (!targetUserId || typeof targetUserId !== 'string') {
      return true;
    }

    // Special case: team leaders+ can view any user (for GET/read endpoints)
    if (
      options.allowTeamLeadersViewAll &&
      this.teamScopeService.isTeamLeaderOrAbove(user)
    ) {
      return true;
    }

    // Check access using TeamScopeService
    const canAccess = await this.teamScopeService.canAccessUser(
      user,
      targetUserId,
    );

    if (!canAccess) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }

    return true;
  }

  private extractUserId(
    request: RequestWithUser,
    paramName: string,
    source?: 'params' | 'query' | 'body',
  ): string | undefined {
    const body = request.body as Record<string, unknown> | undefined;

    // If source is specified, only check that source
    if (source === 'params') {
      return request.params[paramName];
    }
    if (source === 'query') {
      return (request.query[paramName] || request.query['userId']) as string;
    }
    if (source === 'body') {
      const value = body?.[paramName] ?? body?.['userId'];
      return typeof value === 'string' ? value : undefined;
    }

    // Default: check params first, then query, then body
    const bodyValue = body?.[paramName] ?? body?.['userId'];
    return (
      request.params[paramName] ||
      (request.query[paramName] as string | undefined) ||
      (request.query['userId'] as string | undefined) ||
      (typeof bodyValue === 'string' ? bodyValue : undefined)
    );
  }
}
