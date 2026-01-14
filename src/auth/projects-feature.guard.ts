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
export class ProjectsFeatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    if (!req.user?.hasProjectsFeature) {
      throw new ForbiddenException(
        'La funcionalidad de proyectos no está habilitada para tu empresa. Contacta con el administrador para activarla.',
      );
    }

    return true;
  }
}
