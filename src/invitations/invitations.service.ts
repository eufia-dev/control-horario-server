import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInvitationDto } from './dto/index.js';
import { randomBytes } from 'crypto';
import { UserRole, RelationType } from '@prisma/client';
import { EmailService } from '../email/email.service.js';

export interface EnumOption {
  value: string;
  name: string;
}

export interface InvitationOptionsResponse {
  relationTypes: EnumOption[];
  roles: EnumOption[];
}

export interface InvitationResponse {
  id: string;
  email: string;
  role: UserRole;
  relation: RelationType;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create a new invitation
   * Note: TEAM_LEADER role cannot be assigned via invitation because they need a team.
   * Users should be invited as WORKER/ADMIN and promoted to TEAM_LEADER after joining.
   */
  async create(
    companyId: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationResponse> {
    const email = dto.email.toLowerCase();

    // Check if user already exists in this company and is active (not deleted)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email,
        companyId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw new ConflictException('Este usuario ya pertenece a la empresa');
    }

    // Check for existing active invitation
    const existingInvitation = await this.prisma.companyInvitation.findFirst({
      where: {
        email,
        companyId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        'Ya existe una invitación activa para este email',
      );
    }

    // Generate unique token and set expiry (7 days)
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDay() + 7);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.companyInvitation.create({
        data: {
          companyId,
          email,
          role: dto.role || 'WORKER',
          relation: dto.relation || 'EMPLOYEE',
          token,
          expiresAt,
        },
      });

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });

      return {
        invitation: created,
        companyName: company?.name ?? 'tu empresa',
      };
    });

    try {
      await this.emailService.sendInviteEmail({
        to: invitation.invitation.email,
        companyName: invitation.companyName,
        token: invitation.invitation.token,
        role: invitation.invitation.role,
        expiresAt: invitation.invitation.expiresAt,
      });
    } catch (error) {
      await this.prisma.companyInvitation.delete({
        where: { id: invitation.invitation.id },
      });

      this.logger.error(error as Error);
      throw new InternalServerErrorException(
        'No se pudo enviar el correo de invitación. Por favor, inténtalo de nuevo.',
      );
    }

    return this.toResponse(invitation.invitation);
  }

  /**
   * List all invitations for a company
   */
  async findAll(companyId: string): Promise<InvitationResponse[]> {
    const invitations = await this.prisma.companyInvitation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => this.toResponse(inv));
  }

  /**
   * Get a specific invitation
   */
  async findOne(id: string, companyId: string): Promise<InvitationResponse> {
    const invitation = await this.prisma.companyInvitation.findFirst({
      where: { id, companyId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    return this.toResponse(invitation);
  }

  /**
   * Delete/cancel an invitation
   */
  async remove(id: string, companyId: string): Promise<void> {
    const invitation = await this.prisma.companyInvitation.findFirst({
      where: { id, companyId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    await this.prisma.companyInvitation.delete({
      where: { id },
    });
  }

  async resend(id: string, companyId: string): Promise<InvitationResponse> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.companyInvitation.findFirst({
        where: { id, companyId },
      });

      if (!invitation) {
        throw new NotFoundException('Invitación no encontrada');
      }

      if (invitation.usedAt) {
        throw new ConflictException('Esta invitación ya ha sido utilizada');
      }

      // Generate new token and extend expiry
      const token = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setUTCDate(expiresAt.getUTCDay() + 7);

      const updatedInvitation = await tx.companyInvitation.update({
        where: { id },
        data: { token, expiresAt },
      });

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });

      await this.emailService.sendInviteEmail({
        to: updatedInvitation.email,
        companyName: company?.name ?? 'tu empresa',
        token: updatedInvitation.token,
        role: updatedInvitation.role,
        expiresAt: updatedInvitation.expiresAt,
      });

      return updatedInvitation;
    });

    return this.toResponse(updated);
  }

  getOptions(): InvitationOptionsResponse {
    const relationTypeNames: Record<RelationType, string> = {
      [RelationType.EMPLOYEE]: 'Empleado',
      [RelationType.CONTRACTOR]: 'Autónomo',
      [RelationType.GUEST]: 'Invitado',
    };

    // Note: TEAM_LEADER is not available for invitations - must be assigned after joining
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

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private toResponse(invitation: {
    id: string;
    email: string;
    role: UserRole;
    relation: RelationType;
    token: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }): InvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      relation: invitation.relation,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      usedAt: invitation.usedAt,
      createdAt: invitation.createdAt,
    };
  }
}
