import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HolidaysService } from '../holidays/holidays.service.js';
import { JoinRequestsService } from '../join-requests/join-requests.service.js';
import { CreateCompanyDto, RequestJoinDto } from './dto/index.js';
import type { JoinRequest, RelationType, User, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface OnboardingStatus {
  status: 'ACTIVE' | 'ONBOARDING_REQUIRED' | 'PENDING_APPROVAL';
  user?: {
    id: string;
    name: string;
    email: string;
    companyId: string;
    companyName: string;
    role: UserRole;
    relation: RelationType;
    teamId: string | null;
  };
  pendingInvitations?: {
    id: string;
    companyName: string;
    role: UserRole;
    token: string;
  }[];
  pendingRequests?: {
    id: string;
    companyName: string;
    status: string;
    createdAt: Date;
  }[];
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
    private readonly joinRequestsService: JoinRequestsService,
  ) {}

  /**
   * Check the onboarding status for a Supabase user
   */
  async checkStatus(authId: string, email: string): Promise<OnboardingStatus> {
    // First, check if user already has an app account
    const existingUser = await this.prisma.user.findFirst({
      where: { authId },
      include: { company: true },
    });

    if (existingUser) {
      return {
        status: 'ACTIVE',
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          companyId: existingUser.companyId,
          companyName: existingUser.company.name,
          role: existingUser.role,
          relation: existingUser.relation,
          teamId: existingUser.teamId,
        },
      };
    }

    // Check for pending invitations for this email
    const pendingInvitations = await this.prisma.companyInvitation.findMany({
      where: {
        email: email.toLowerCase(),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { company: true },
    });

    // Check for pending join requests
    const pendingRequests = await this.prisma.joinRequest.findMany({
      where: {
        authId,
        status: 'PENDING',
      },
      include: { company: true },
    });

    if (pendingRequests.length > 0) {
      return {
        status: 'PENDING_APPROVAL',
        pendingInvitations: pendingInvitations.map((inv) => ({
          id: inv.id,
          companyName: inv.company.name,
          role: inv.role,
          token: inv.token,
        })),
        pendingRequests: pendingRequests.map((req) => ({
          id: req.id,
          companyName: req.company.name,
          status: req.status,
          createdAt: req.createdAt,
        })),
      };
    }

    return {
      status: 'ONBOARDING_REQUIRED',
      pendingInvitations: pendingInvitations.map((inv) => ({
        id: inv.id,
        companyName: inv.company.name,
        role: inv.role,
        token: inv.token,
      })),
    };
  }

  /**
   * Create a new company and user as OWNER.
   * Supports multi-tenancy: existing users can create additional companies.
   */
  async createCompany(
    authId: string,
    email: string,
    dto: CreateCompanyDto,
  ): Promise<OnboardingStatus> {
    // Check if CIF is already in use (if provided)
    if (dto.cif) {
      const existingCompany = await this.prisma.company.findUnique({
        where: { cif: dto.cif },
      });

      if (existingCompany) {
        throw new ConflictException('El CIF ya está registrado');
      }
    }

    // Generate a unique invite code for the company
    const inviteCode = this.generateInviteCode();

    // Create company, location, and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          cif: dto.cif || null,
          inviteCode,
        },
      });

      // Create company location with full address
      await tx.companyLocation.create({
        data: {
          companyId: company.id,
          regionCode: dto.regionCode,
          provinceCode: dto.provinceCode,
          municipalityName: dto.municipalityName,
          address: dto.address,
          postalCode: dto.postalCode,
        },
      });

      // Create default work schedule: Mon-Fri 09:00-17:00
      await tx.workSchedule.createMany({
        data: [
          {
            companyId: company.id,
            userId: null,
            dayOfWeek: 0,
            startTime: '09:00',
            endTime: '17:00',
          }, // Monday
          {
            companyId: company.id,
            userId: null,
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '17:00',
          }, // Tuesday
          {
            companyId: company.id,
            userId: null,
            dayOfWeek: 2,
            startTime: '09:00',
            endTime: '17:00',
          }, // Wednesday
          {
            companyId: company.id,
            userId: null,
            dayOfWeek: 3,
            startTime: '09:00',
            endTime: '17:00',
          }, // Thursday
          {
            companyId: company.id,
            userId: null,
            dayOfWeek: 4,
            startTime: '09:00',
            endTime: '17:00',
          }, // Friday
        ],
      });

      const user = await tx.user.create({
        data: {
          authId,
          email: email.toLowerCase(),
          name: dto.userName,
          companyId: company.id,
          role: 'OWNER',
          hourlyCost: 0,
        },
      });

      // Create default notification settings for the user
      await tx.notificationSettings.create({
        data: { userId: user.id },
      });

      return { company, user };
    });

    // After transaction: sync holidays using regionCode
    try {
      const currentYear = new Date().getFullYear();
      await this.holidaysService.syncHolidaysForCompany(
        result.company.id,
        dto.regionCode,
        [currentYear, currentYear + 1],
      );
      this.logger.log(
        `Holidays synced for new company ${result.company.id} in region ${dto.regionCode}`,
      );
    } catch (error) {
      // Log error but don't fail company creation if holiday sync fails
      this.logger.error(`Failed to sync holidays for company: ${error}`);
    }

    return {
      status: 'ACTIVE',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        companyId: result.company.id,
        companyName: result.company.name,
        role: result.user.role,
        relation: result.user.relation,
        teamId: result.user.teamId,
      },
    };
  }

  /**
   * Accept an invitation and create user profile in that company.
   * Supports multi-tenancy: allows existing users to join additional companies.
   */
  async acceptInvitation(
    authId: string,
    email: string,
    token: string,
    userName: string,
  ): Promise<OnboardingStatus> {
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

    // Check if user already exists in THIS specific company (not globally) and is active
    const existingActiveUserInCompany = await this.prisma.user.findFirst({
      where: {
        authId,
        companyId: invitation.companyId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (existingActiveUserInCompany) {
      throw new ConflictException('Ya eres miembro de esta empresa');
    }

    // Check if there's a deleted/inactive user with this email in this company
    const deletedUserInCompany = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        companyId: invitation.companyId,
        OR: [{ isActive: false }, { deletedAt: { not: null } }],
      },
    });

    // Create or reactivate user profile and mark invitation as used
    const result = await this.prisma.$transaction(async (tx) => {
      let user: User | null = null;

      if (deletedUserInCompany) {
        user = await tx.user.update({
          where: { id: deletedUserInCompany.id },
          data: {
            authId,
            email: email.toLowerCase(),
            name: userName,
            role: invitation.role,
            relation: invitation.relation,
            isActive: true,
            deletedAt: null,
            updatedAt: new Date(),
          },
        });

        if (!user) {
          throw new Error('Failed to reactivate user');
        }

        // Ensure notification settings exist (create if not present)
        await tx.notificationSettings.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        });
      } else {
        user = await tx.user.create({
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

        // Create default notification settings for the new user
        await tx.notificationSettings.create({
          data: { userId: user.id },
        });
      }

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

      return { user, company: invitation.company };
    });

    return {
      status: 'ACTIVE',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        companyId: result.company.id,
        companyName: result.company.name,
        role: result.user.role,
        relation: result.user.relation,
        teamId: result.user.teamId,
      },
    };
  }

  /**
   * Request to join a company.
   * Supports multi-tenancy: allows existing users to request joining additional companies.
   * Also allows previously deleted users to request rejoining.
   */
  async requestJoin(
    authId: string,
    email: string,
    dto: RequestJoinDto,
  ): Promise<{ id: string; companyName: string; status: string }> {
    // Check if company exists
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Check if user already exists in THIS specific company and is active (not deleted)
    const existingActiveUserInCompany = await this.prisma.user.findFirst({
      where: {
        authId,
        companyId: dto.companyId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (existingActiveUserInCompany) {
      throw new ConflictException('Ya eres miembro de esta empresa');
    }

    // Also check by email for active users (in case authId is different but same email)
    const existingActiveUserByEmail = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        companyId: dto.companyId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (existingActiveUserByEmail) {
      throw new ConflictException('Ya eres miembro de esta empresa');
    }

    // Check for existing pending request
    const existingRequest = await this.prisma.joinRequest.findUnique({
      where: {
        companyId_authId: {
          companyId: dto.companyId,
          authId,
        },
      },
    });

    let joinRequest: JoinRequest | null = null;

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

      if (existingRequest.status === 'APPROVED') {
        joinRequest = await this.prisma.joinRequest.update({
          where: { id: existingRequest.id },
          data: {
            email: email.toLowerCase(),
            name: dto.name,
            status: 'PENDING',
            reviewedAt: null,
            reviewedById: null,
          },
        });
      }
    }

    if (!joinRequest) {
      joinRequest = await this.prisma.joinRequest.create({
        data: {
          companyId: dto.companyId,
          authId,
          email: email.toLowerCase(),
          name: dto.name,
        },
      });
    }

    // Notify admins of the new join request (non-blocking)
    this.joinRequestsService
      .notifyAdminsOfJoinRequest(dto.companyId, dto.name, email)
      .catch((error) => {
        this.logger.error(`Failed to send join request notification: ${error}`);
      });

    return {
      id: joinRequest.id,
      companyName: company.name,
      status: joinRequest.status,
    };
  }

  /**
   * Get user's pending join requests
   */
  async getMyRequests(
    authId: string,
  ): Promise<
    { id: string; companyName: string; status: string; createdAt: Date }[]
  > {
    const requests = await this.prisma.joinRequest.findMany({
      where: { authId },
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      companyName: req.company.name,
      status: req.status,
      createdAt: req.createdAt,
    }));
  }

  /**
   * Cancel a pending join request
   */
  async cancelRequest(authId: string, requestId: string): Promise<void> {
    const request = await this.prisma.joinRequest.findFirst({
      where: {
        id: requestId,
        authId,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada o ya procesada');
    }

    await this.prisma.joinRequest.delete({
      where: { id: requestId },
    });
  }

  private generateInviteCode(): string {
    // Generate a random 8-character alphanumeric code
    return randomBytes(4).toString('hex').toUpperCase();
  }
}
