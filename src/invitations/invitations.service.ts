import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInvitationDto } from './dto/index.js';
import { randomBytes } from 'crypto';
import type { UserRole } from '@prisma/client';
import { EmailService } from '../email/email.service.js';

export interface InvitationResponse {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create a new invitation
   */
  async create(
    companyId: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationResponse> {
    const email = dto.email.toLowerCase();

    // Check if user already exists in this company
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email,
        companyId,
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
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.companyInvitation.create({
        data: {
          companyId,
          email,
          role: dto.role || 'WORKER',
          token,
          expiresAt,
        },
      });

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });

      await this.sendInviteEmail(created, company?.name ?? 'tu empresa');

      return created;
    });

    return this.toResponse(invitation);
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

  /**
   * Resend an invitation (regenerate token and extend expiry)
   */
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
      expiresAt.setDate(expiresAt.getDate() + 7);

      const updatedInvitation = await tx.companyInvitation.update({
        where: { id },
        data: { token, expiresAt },
      });

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });

      await this.sendInviteEmail(
        updatedInvitation,
        company?.name ?? 'tu empresa',
      );

      return updatedInvitation;
    });

    return this.toResponse(updated);
  }

  private getInviteBaseUrl(): string {
    const base = process.env.INVITE_BASE_URL || process.env.FRONTEND_ORIGIN;

    if (!base) {
      throw new InternalServerErrorException(
        'No está configurada la URL base para las invitaciones. Contacta con el administrador.',
      );
    }

    return base.replace(/\/$/, '');
  }

  private buildInviteLink(token: string): string {
    return `${this.getInviteBaseUrl()}/invite/${token}`;
  }

  private async sendInviteEmail(
    invitation: {
      email: string;
      token: string;
      role: UserRole;
      expiresAt: Date;
    },
    companyName: string,
  ): Promise<void> {
    const inviteLink = this.buildInviteLink(invitation.token);

    await this.emailService.sendInviteEmail({
      to: invitation.email,
      companyName,
      inviteLink,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    });
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private toResponse(invitation: {
    id: string;
    email: string;
    role: UserRole;
    token: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }): InvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      usedAt: invitation.usedAt,
      createdAt: invitation.createdAt,
    };
  }
}
