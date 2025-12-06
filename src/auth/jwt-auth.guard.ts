import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, OnboardingRequiredError } from './auth.service.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
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

    try {
      // Validate token via Supabase and get user data
      const authUser = await this.authService.validateToken(token);

      // Attach user payload to request
      req.user = {
        sub: authUser.id,
        authId: authUser.authId,
        email: authUser.email,
        companyId: authUser.companyId,
        role: authUser.role,
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
      console.error('Error in JwtAuthGuard:', error);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
