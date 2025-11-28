import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    if (!req.user?.isAdmin) {
      throw new ForbiddenException('Acceso restringido a administradores');
    }
    return true;
  }
}
