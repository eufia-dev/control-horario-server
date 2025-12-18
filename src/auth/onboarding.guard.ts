import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service.js';

export interface OnboardingPayload {
  authId: string;
  email: string;
}

interface RequestWithOnboarding extends Request {
  onboardingUser: OnboardingPayload;
}

/**
 * Guard that validates Supabase token without requiring an app user record.
 * Used for onboarding endpoints where the user hasn't joined a company yet.
 */
@Injectable()
export class OnboardingGuard implements CanActivate {
  private readonly logger = new Logger(OnboardingGuard.name);
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithOnboarding>();

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
      // Verify token with Supabase Admin SDK
      const {
        data: { user: supabaseUser },
        error,
      } = await this.supabase.getAdminClient().auth.getUser(token);

      if (error || !supabaseUser) {
        throw new UnauthorizedException('Token inválido o expirado');
      }

      if (!supabaseUser.email) {
        throw new UnauthorizedException('Usuario sin email verificado');
      }

      // Attach minimal user info to request (no app user required)
      req.onboardingUser = {
        authId: supabaseUser.id,
        email: supabaseUser.email,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error in OnboardingGuard:', error);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
