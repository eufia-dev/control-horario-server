import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  authId: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export interface SupabaseUser {
  id: string;
  email: string;
}

/**
 * Custom error for users who need to complete onboarding
 */
export class OnboardingRequiredError extends UnauthorizedException {
  constructor(
    public readonly authId: string,
    public readonly email: string,
  ) {
    super({
      statusCode: 401,
      error: 'ONBOARDING_REQUIRED',
      message: 'Usuario requiere completar el proceso de registro',
    });
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Validates a Supabase access token and returns the Supabase user info
   * Does not require an app user to exist
   */
  async validateSupabaseToken(accessToken: string): Promise<SupabaseUser> {
    const {
      data: { user: supabaseUser },
      error,
    } = await this.supabase.getAdminClient().auth.getUser(accessToken);

    if (error || !supabaseUser) {
      console.error('Error validating token:', error);
      throw new UnauthorizedException('Token inválido o expirado');
    }

    if (!supabaseUser.email) {
      throw new UnauthorizedException('Usuario sin email verificado');
    }

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
    };
  }

  /**
   * Validates a Supabase access token and returns the associated app user
   * Throws OnboardingRequiredError if user doesn't have an app account yet
   */
  async validateToken(accessToken: string): Promise<AuthUser> {
    const supabaseUser = await this.validateSupabaseToken(accessToken);

    // Fetch app user by authId (Supabase UID)
    const appUser = await this.prisma.user.findFirst({
      where: { authId: supabaseUser.id },
      include: { company: true },
    });

    if (!appUser) {
      throw new OnboardingRequiredError(supabaseUser.id, supabaseUser.email);
    }

    if (!appUser.isActive) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    return this.toAuthUser(appUser);
  }

  /**
   * Get user profile by user ID
   */
  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return this.toAuthUser(user);
  }

  /**
   * Check if a user with this authId already exists
   */
  async userExists(authId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { authId },
    });
    return !!user;
  }

  /**
   * Get pending invitations for an email
   */
  getPendingInvitations(email: string) {
    return this.prisma.companyInvitation.findMany({
      where: {
        email: email.toLowerCase(),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { company: true },
    });
  }

  private toAuthUser(user: {
    id: string;
    authId: string;
    name: string;
    email: string;
    companyId: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    company?: { name: string } | null;
  }): AuthUser {
    return {
      id: user.id,
      authId: user.authId,
      name: user.name,
      email: user.email,
      companyId: user.companyId,
      companyName: user.company?.name ?? '',
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
