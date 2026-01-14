import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { JoinRequestsService } from '../join-requests/join-requests.service.js';
import type { UserRole, RelationType } from '@prisma/client';

export interface AuthUser {
  id: string;
  authId: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  role: UserRole;
  relation: RelationType;
  teamId: string | null;
  isActive: boolean;
  createdAt: Date;
  hasProjectsFeature: boolean;
}

export interface ProfileInfo {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  relation: RelationType;
  teamId: string | null;
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
  relation: RelationType;
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
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => JoinRequestsService))
    private readonly joinRequestsService: JoinRequestsService,
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
      this.logger.error('Error validating token:', error);
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
        throw new UnauthorizedException(
          'Perfil no válido o no pertenece a este usuario',
        );
      }
      throw new OnboardingRequiredError(supabaseUser.id, supabaseUser.email);
    }

    if (!appUser.isActive) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    return this.toAuthUser(appUser);
  }

  /**
   * Save the user's current profile preference to Supabase user metadata
   */
  async saveProfilePreference(
    authId: string,
    profileId: string,
  ): Promise<void> {
    await this.supabase.updateUser(authId, {
      user_metadata: { currentProfileId: profileId },
    });
  }

  /**
   * Get the user's stored profile preference from Supabase user metadata
   */
  async getStoredProfilePreference(authId: string): Promise<string | null> {
    const metadata = await this.supabase.getUserMetadata(authId);
    if (!metadata || typeof metadata.currentProfileId !== 'string') {
      return null;
    }
    return metadata.currentProfileId;
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
      relation: user.relation,
      teamId: user.teamId,
      company: {
        id: user.company.id,
        name: user.company.name,
        logoUrl: user.company.logoUrl,
      },
    }));
  }

  /**
   * Get all profiles with the current profile ID preference
   * Falls back to first profile if no preference is stored or if stored preference is invalid
   */
  async getAllProfilesWithCurrentId(
    authId: string,
  ): Promise<{ profiles: ProfileInfo[]; currentProfileId: string | null }> {
    const [profiles, storedPreference] = await Promise.all([
      this.getAllProfiles(authId),
      this.getStoredProfilePreference(authId),
    ]);

    if (profiles.length === 0) {
      return { profiles, currentProfileId: null };
    }

    // Check if stored preference is valid (exists in the profiles list)
    const isStoredPreferenceValid =
      storedPreference && profiles.some((p) => p.id === storedPreference);

    // Use stored preference if valid, otherwise fall back to first profile
    const currentProfileId = isStoredPreferenceValid
      ? storedPreference
      : profiles[0].id;

    return { profiles, currentProfileId };
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
      relation: inv.relation,
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
          relation: invitation.relation,
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
      relation: result.relation,
      teamId: result.teamId,
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

    // Notify admins of the new join request (non-blocking)
    this.joinRequestsService
      .notifyAdminsOfJoinRequest(company.id, name, email)
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send join request notification: ${String(error)}`,
        );
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
    teamId: string | null;
    role: UserRole;
    relation: RelationType;
    isActive: boolean;
    createdAt: Date;
    company?: { name: string; hasProjectsFeature?: boolean } | null;
  }): AuthUser {
    return {
      id: user.id,
      authId: user.authId,
      name: user.name,
      email: user.email,
      companyId: user.companyId,
      companyName: user.company?.name ?? '',
      role: user.role,
      relation: user.relation,
      teamId: user.teamId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      hasProjectsFeature: user.company?.hasProjectsFeature ?? false,
    };
  }
}
