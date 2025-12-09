import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCompanyDto, RequestJoinDto } from './dto/index.js';
import type { UserRole } from '@prisma/client';
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
  constructor(private readonly prisma: PrismaService) {}

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
   * Create a new company and user as OWNER
   */
  async createCompany(
    authId: string,
    email: string,
    dto: CreateCompanyDto,
  ): Promise<OnboardingStatus> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { authId },
    });

    if (existingUser) {
      throw new ConflictException('El usuario ya tiene una cuenta');
    }

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

    // Create company and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          cif: dto.cif || null,
          inviteCode,
        },
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

      return { company, user };
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
      },
    };
  }

  /**
   * Accept an invitation and create user
   */
  async acceptInvitation(
    authId: string,
    email: string,
    token: string,
    userName: string,
  ): Promise<OnboardingStatus> {
    const existingUser = await this.prisma.user.findFirst({
      where: { authId },
    });

    if (existingUser) {
      throw new ConflictException('El usuario ya tiene una cuenta');
    }

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

    // Create user and mark invitation as used
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          authId,
          email: email.toLowerCase(),
          name: userName,
          companyId: invitation.companyId,
          role: invitation.role,
          hourlyCost: 0,
        },
      });

      await tx.companyInvitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });

      // NEW: Cancel any pending join requests from this user to this company
      await tx.joinRequest.updateMany({
        where: {
          authId,
          companyId: invitation.companyId,
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED', // Or you could add a new status like 'CANCELLED' or 'RESOLVED_VIA_INVITATION'
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
      },
    };
  }

  /**
   * Request to join a company
   */
  async requestJoin(
    authId: string,
    email: string,
    dto: RequestJoinDto,
  ): Promise<{ id: string; companyName: string; status: string }> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { authId },
    });

    if (existingUser) {
      throw new ConflictException('El usuario ya tiene una cuenta');
    }

    // Check if company exists
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
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
        companyId: dto.companyId,
        authId,
        email: email.toLowerCase(),
        name: dto.name,
      },
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
