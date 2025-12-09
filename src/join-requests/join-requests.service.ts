import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApproveRequestDto } from './dto/index.js';
import { JoinRequestStatus, UserRole, RelationType } from '@prisma/client';

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
    relationType: RelationType;
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
  constructor(private readonly prisma: PrismaService) {}

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
   * Approve a join request and create user
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

    // Create user and update request in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          authId: request.authId,
          email: request.email,
          name: request.name,
          companyId,
          role: dto.role || 'WORKER',
          relationType: dto.relationType || 'EMPLOYEE',
          hourlyCost: 0,
        },
      });

      // Update the request
      const updatedRequest = await tx.joinRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: reviewerId,
        },
      });

      // NEW: Mark any pending invitations for this email/company as used
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
        relationType: result.user.relationType,
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
