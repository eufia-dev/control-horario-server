import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { UserRole, RelationType } from '@prisma/client';

export interface AuthUser {
  id: string;
  authId: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  role: UserRole;
  relationType: RelationType;
  isActive: boolean;
  createdAt: Date;
}

export interface ProfileInfo {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  relationType: RelationType;
  company: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
}

export interface SupabaseUser {
  id: string;
  email: string;
}

export interface PendingInvitation {
  id: string;
  token: string;
  role: UserRole;
  relationType: RelationType;
  expiresAt: Date;
  company: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
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
   * @param accessToken - Supabase access token
   * @param profileId - Optional profile ID to select a specific user profile
   */
  async validateToken(
    accessToken: string,
    profileId?: string,
  ): Promise<AuthUser> {
    const supabaseUser = await this.validateSupabaseToken(accessToken);

    // Build where clause - if profileId is provided, validate it belongs to this authId
    const whereClause = profileId
      ? { id: profileId, authId: supabaseUser.id }
      : { authId: supabaseUser.id };

    // Fetch app user by authId (Supabase UID) and optionally profileId
    const appUser = await this.prisma.user.findFirst({
      where: whereClause,
      include: { company: true },
    });

    if (!appUser) {
      // If profileId was provided but not found, it's an invalid profile
      if (profileId) {
        throw new UnauthorizedException('Perfil no válido o no pertenece a este usuario');
      }
      throw new OnboardingRequiredError(supabaseUser.id, supabaseUser.email);
    }

    if (!appUser.isActive) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    return this.toAuthUser(appUser);
  }

  /**
   * Get all profiles (user records) for a given Supabase authId
   * Returns all active, non-deleted profiles with their company info
   */
  async getAllProfiles(authId: string): Promise<ProfileInfo[]> {
    const users = await this.prisma.user.findMany({
      where: {
        authId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      relationType: user.relationType,
      company: {
        id: user.company.id,
        name: user.company.name,
        logoUrl: user.company.logoUrl,
      },
    }));
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

  /**
   * Get pending invitations for an authenticated user
   * Excludes companies the user is already a member of
   */
  async getPendingInvitationsForUser(
    email: string,
    authId: string,
  ): Promise<PendingInvitation[]> {
    // Get companies the user is already a member of
    const existingMemberships = await this.prisma.user.findMany({
      where: { authId },
      select: { companyId: true },
    });
    const existingCompanyIds = existingMemberships.map((m) => m.companyId);

    // Get pending invitations excluding companies user is already in
    const invitations = await this.prisma.companyInvitation.findMany({
      where: {
        email: email.toLowerCase(),
        usedAt: null,
        expiresAt: { gt: new Date() },
        companyId: { notIn: existingCompanyIds },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      token: inv.token,
      role: inv.role,
      relationType: inv.relationType,
      expiresAt: inv.expiresAt,
      company: inv.company,
    }));
  }

  /**
   * Accept an invitation for an existing authenticated user
   * Creates a new profile in the invited company
   */
  async acceptInvitationForExistingUser(
    authId: string,
    email: string,
    token: string,
  ): Promise<ProfileInfo> {
    const invitation = await this.prisma.companyInvitation.findUnique({
      where: { token },
      include: { company: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.usedAt) {
      throw new BadRequestException('Esta invitación ya ha sido utilizada');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Esta invitación ha expirado');
    }

    // Verify email matches (case insensitive)
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('El email no coincide con la invitación');
    }

    // Check if user already exists in this company
    const existingUserInCompany = await this.prisma.user.findFirst({
      where: {
        authId,
        companyId: invitation.companyId,
      },
    });

    if (existingUserInCompany) {
      throw new ConflictException('Ya eres miembro de esta empresa');
    }

    // Get an existing profile to use the name
    const existingProfile = await this.prisma.user.findFirst({
      where: { authId },
    });

    const userName = existingProfile?.name ?? email.split('@')[0];

    // Create user profile and mark invitation as used
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          authId,
          email: email.toLowerCase(),
          name: userName,
          companyId: invitation.companyId,
          role: invitation.role,
          relationType: invitation.relationType,
          hourlyCost: 0,
        },
      });

      await tx.companyInvitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });

      // Cancel any pending join requests from this user to this company
      await tx.joinRequest.updateMany({
        where: {
          authId,
          companyId: invitation.companyId,
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });

      return user;
    });

    return {
      id: result.id,
      name: result.name,
      email: result.email,
      role: result.role,
      relationType: result.relationType,
      company: {
        id: invitation.company.id,
        name: invitation.company.name,
        logoUrl: invitation.company.logoUrl,
      },
    };
  }

  /**
   * Request to join a company by invite code (for authenticated users)
   */
  async requestJoinByInviteCode(
    authId: string,
    email: string,
    name: string,
    inviteCode: string,
  ): Promise<{ companyName: string; status: string }> {
    // Find company by invite code
    const company = await this.prisma.company.findUnique({
      where: { inviteCode },
    });

    if (!company) {
      throw new NotFoundException('Código de invitación no válido');
    }

    // Check if user already exists in this company
    const existingUserInCompany = await this.prisma.user.findFirst({
      where: {
        authId,
        companyId: company.id,
      },
    });

    if (existingUserInCompany) {
      throw new ConflictException('Ya eres miembro de esta empresa');
    }

    // Check for existing pending request
    const existingRequest = await this.prisma.joinRequest.findUnique({
      where: {
        companyId_authId: {
          companyId: company.id,
          authId,
        },
      },
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        throw new ConflictException(
          'Ya tienes una solicitud pendiente para esta empresa',
        );
      }
      if (existingRequest.status === 'REJECTED') {
        throw new BadRequestException(
          'Tu solicitud anterior fue rechazada. Contacta con el administrador.',
        );
      }
    }

    const joinRequest = await this.prisma.joinRequest.create({
      data: {
        companyId: company.id,
        authId,
        email: email.toLowerCase(),
        name,
      },
    });

    return {
      companyName: company.name,
      status: joinRequest.status,
    };
  }

  private toAuthUser(user: {
    id: string;
    authId: string;
    name: string;
    email: string;
    companyId: string;
    role: UserRole;
    relationType: RelationType;
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
      relationType: user.relationType,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
