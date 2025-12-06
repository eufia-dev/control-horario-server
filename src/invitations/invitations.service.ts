import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInvitationDto } from './dto/index.js';
import { randomBytes } from 'crypto';
import type { UserRole } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

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

    const invitation = await this.prisma.companyInvitation.create({
      data: {
        companyId,
        email,
        role: dto.role || 'WORKER',
        token,
        expiresAt,
      },
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
    const invitation = await this.prisma.companyInvitation.findFirst({
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

    const updated = await this.prisma.companyInvitation.update({
      where: { id },
      data: { token, expiresAt },
    });

    return this.toResponse(updated);
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
