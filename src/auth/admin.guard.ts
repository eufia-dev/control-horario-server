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
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    // Allow OWNER and ADMIN roles
    const allowedRoles = ['OWNER', 'ADMIN'];

    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenException('Acceso restringido a administradores');
    }

    return true;
  }
}
