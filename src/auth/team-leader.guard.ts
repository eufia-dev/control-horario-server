import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Injectable()
export class TeamLeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    // Allow OWNER, ADMIN, and TEAM_LEADER roles
    const allowedRoles = ['OWNER', 'ADMIN', 'TEAM_LEADER'];

    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenException(
        'Acceso restringido a administradores y líderes de equipo',
      );
    }

    return true;
  }
}
