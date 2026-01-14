import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { ApproveRequestDto } from './dto/index.js';
import {
  JoinRequestStatus,
  UserRole,
  RelationType,
  User,
} from '@prisma/client';

export interface JoinRequestResponse {
  id: string;
  email: string;
  name: string;
  status: JoinRequestStatus;
  createdAt: Date;
  reviewedAt: Date | null;
}

export interface JoinRequestWithUser extends JoinRequestResponse {
  user?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    relation: RelationType;
  };
}

export interface EnumOption {
  value: string;
  name: string;
}

export interface ApproveOptionsResponse {
  relationTypes: EnumOption[];
  roles: EnumOption[];
}

@Injectable()
export class JoinRequestsService {
  private readonly logger = new Logger(JoinRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * List all join requests for a company
   */
  async findAll(
    companyId: string,
    status?: JoinRequestStatus,
  ): Promise<JoinRequestResponse[]> {
    const requests = await this.prisma.joinRequest.findMany({
      where: {
        companyId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => this.toResponse(req));
  }

  /**
   * Get pending requests count for badge/notification
   */
  async getPendingCount(companyId: string): Promise<number> {
    return this.prisma.joinRequest.count({
      where: {
        companyId,
        status: 'PENDING',
      },
    });
  }

  /**
   * Get a specific join request
   */
  async findOne(id: string, companyId: string): Promise<JoinRequestResponse> {
    const request = await this.prisma.joinRequest.findFirst({
      where: { id, companyId },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    return this.toResponse(request);
  }

  /**
   * Approve a join request and create/reactivate user
   * Handles the case where a previously deleted user is rejoining the company
   */
  /**
   * Approve a join request.
   * Note: TEAM_LEADER role cannot be assigned when approving - requires team assignment.
   * Users should be approved as WORKER/ADMIN and promoted to TEAM_LEADER after joining.
   */
  async approve(
    id: string,
    companyId: string,
    reviewerId: string,
    dto: ApproveRequestDto,
  ): Promise<JoinRequestWithUser> {
    const request = await this.prisma.joinRequest.findFirst({
      where: { id, companyId },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya ha sido procesada');
    }

    // Check if there's a deleted/inactive user with this email in this company
    const deletedUserInCompany = await this.prisma.user.findFirst({
      where: {
        email: request.email.toLowerCase(),
        companyId,
        OR: [{ isActive: false }, { deletedAt: { not: null } }],
      },
    });

    // Create or reactivate user and update request in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      let user: User | null = null;

      if (deletedUserInCompany) {
        // Reactivate existing user: update with new authId and details
        user = await tx.user.update({
          where: { id: deletedUserInCompany.id },
          data: {
            authId: request.authId,
            email: request.email.toLowerCase(),
            name: request.name,
            role: dto.role || 'WORKER',
            relation: dto.relation || 'EMPLOYEE',
            isActive: true,
            deletedAt: null,
            updatedAt: new Date(),
          },
        });

        if (!user) {
          throw new Error('Failed to reactivate user');
        }

        await tx.notificationSettings.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        });
      } else {
        // Create new user
        user = await tx.user.create({
          data: {
            authId: request.authId,
            email: request.email,
            name: request.name,
            companyId,
            role: dto.role || 'WORKER',
            relation: dto.relation || 'EMPLOYEE',
            hourlyCost: 0,
          },
        });

        // Create default notification settings for the new user
        await tx.notificationSettings.create({
          data: { userId: user.id },
        });
      }

      // Update the request
      const updatedRequest = await tx.joinRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: reviewerId,
        },
      });

      // Mark any pending invitations for this email/company as used
      await tx.companyInvitation.updateMany({
        where: {
          email: request.email.toLowerCase(),
          companyId,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      return { request: updatedRequest, user };
    });

    return {
      ...this.toResponse(result.request),
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        relation: result.user.relation,
      },
    };
  }

  /**
   * Reject a join request
   */
  async reject(
    id: string,
    companyId: string,
    reviewerId: string,
  ): Promise<JoinRequestResponse> {
    const request = await this.prisma.joinRequest.findFirst({
      where: { id, companyId },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya ha sido procesada');
    }

    const updated = await this.prisma.joinRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });

    return this.toResponse(updated);
  }

  getOptions(): ApproveOptionsResponse {
    const relationTypeNames: Record<RelationType, string> = {
      [RelationType.EMPLOYEE]: 'Empleado',
      [RelationType.CONTRACTOR]: 'Autónomo',
      [RelationType.GUEST]: 'Invitado',
    };

    // Note: TEAM_LEADER is not available for approvals - must be assigned after joining
    const roleNames: Record<string, string> = {
      [UserRole.ADMIN]: 'Administrador',
      [UserRole.WORKER]: 'Trabajador',
      [UserRole.AUDITOR]: 'Auditor',
    };

    const availableRoles = [UserRole.ADMIN, UserRole.WORKER, UserRole.AUDITOR];

    return {
      relationTypes: Object.values(RelationType).map((value) => ({
        value,
        name: relationTypeNames[value],
      })),
      roles: availableRoles.map((value) => ({
        value,
        name: roleNames[value],
      })),
    };
  }

  /**
   * Notify company admins of a new join request
   */
  async notifyAdminsOfJoinRequest(
    companyId: string,
    requesterName: string,
    requesterEmail: string,
  ): Promise<void> {
    // Get company name
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    if (!company) {
      this.logger.warn(
        `Cannot send join request notification: company ${companyId} not found`,
      );
      return;
    }

    // Get all admins (OWNER or ADMIN roles)
    const admins = await this.prisma.user.findMany({
      where: {
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (admins.length === 0) {
      this.logger.warn(
        `No admins found for company ${companyId} to notify about join request`,
      );
      return;
    }

    // Send email to each admin
    const emailPromises = admins.map((admin) =>
      this.emailService.sendJoinRequestNotification({
        to: admin.email,
        adminName: admin.name,
        requesterName,
        requesterEmail,
        companyName: company.name,
      }),
    );

    await Promise.allSettled(emailPromises);
  }

  private toResponse(request: {
    id: string;
    email: string;
    name: string;
    status: JoinRequestStatus;
    createdAt: Date;
    reviewedAt: Date | null;
  }): JoinRequestResponse {
    return {
      id: request.id,
      email: request.email,
      name: request.name,
      status: request.status,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
    };
  }
}
