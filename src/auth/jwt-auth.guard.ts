import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, OnboardingRequiredError } from './auth.service.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

export interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticación faltante');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new UnauthorizedException('Token de autenticación faltante');
    }

    // Extract optional X-Profile-Id header for multi-tenancy support
    const profileId = req.headers['x-profile-id'] as string | undefined;

    try {
      // Validate token via Supabase and get user data
      // If profileId is provided, it will validate that the profile belongs to this authId
      const authUser = await this.authService.validateToken(token, profileId);

      // Attach user payload to request (including relation for NotGuestGuard, teamId for team scoping)
      req.user = {
        sub: authUser.id,
        authId: authUser.authId,
        email: authUser.email,
        companyId: authUser.companyId,
        role: authUser.role,
        relation: authUser.relation,
        teamId: authUser.teamId,
        hasProjectsFeature: authUser.hasProjectsFeature,
        hasCostsFeature: authUser.hasCostsFeature,
      };

      return true;
    } catch (error) {
      // Re-throw OnboardingRequiredError with its specific response
      if (error instanceof OnboardingRequiredError) {
        throw error;
      }
      // Re-throw UnauthorizedException as-is
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error in JwtAuthGuard:', error);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
