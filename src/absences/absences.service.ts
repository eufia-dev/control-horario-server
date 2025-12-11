import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAbsenceDto } from './dto/create-absence.dto.js';
import type { ReviewAbsenceDto } from './dto/review-absence.dto.js';
import { AbsenceType, AbsenceStatus, type UserAbsence } from '@prisma/client';

export interface AbsenceResponse {
  id: string;
  userId: string;
  companyId: string;
  startDate: Date;
  endDate: Date;
  type: AbsenceType;
  status: AbsenceStatus;
  notes: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  reviewedBy?: {
    id: string;
    name: string;
  } | null;
}

export interface AbsenceTypeOption {
  value: AbsenceType;
  name: string;
}

export interface AbsenceStats {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

@Injectable()
export class AbsencesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get absence type enum values for frontend dropdown
   */
  getTypes(): AbsenceTypeOption[] {
    const typeNames: Record<AbsenceType, string> = {
      [AbsenceType.VACATION]: 'Vacaciones',
      [AbsenceType.SICK_LEAVE]: 'Baja por enfermedad',
      [AbsenceType.PERSONAL_LEAVE]: 'Asuntos propios',
      [AbsenceType.MATERNITY]: 'Maternidad',
      [AbsenceType.PATERNITY]: 'Paternidad',
      [AbsenceType.UNPAID_LEAVE]: 'Excedencia',
      [AbsenceType.TRAINING]: 'Formación',
      [AbsenceType.OTHER]: 'Otro',
    };

    return Object.values(AbsenceType).map((value) => ({
      value,
      name: typeNames[value],
    }));
  }

  // ============================================
  // USER METHODS
  // ============================================

  /**
   * Request a new absence (creates with PENDING status)
   */
  async requestAbsence(
    userId: string,
    companyId: string,
    dto: CreateAbsenceDto,
  ): Promise<AbsenceResponse> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Validate dates
    if (endDate < startDate) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }

    // Check for overlapping absences
    const overlapping = await this.prisma.userAbsence.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'Ya existe una ausencia que se solapa con las fechas seleccionadas',
      );
    }

    const absence = await this.prisma.userAbsence.create({
      data: {
        userId,
        companyId,
        startDate,
        endDate,
        type: dto.type,
        notes: dto.notes || null,
        status: 'PENDING',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return this.toAbsenceResponse(absence);
  }

  /**
   * Get current user's absences
   */
  async getMyAbsences(
    userId: string,
    companyId: string,
    status?: AbsenceStatus,
  ): Promise<AbsenceResponse[]> {
    const absences = await this.prisma.userAbsence.findMany({
      where: {
        userId,
        companyId,
        ...(status && { status }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return absences.map((a) => this.toAbsenceResponse(a));
  }

  /**
   * Cancel a pending absence (user can only cancel their own pending requests)
   */
  async cancelAbsence(
    userId: string,
    absenceId: string,
  ): Promise<AbsenceResponse> {
    const absence = await this.prisma.userAbsence.findFirst({
      where: {
        id: absenceId,
        userId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!absence) {
      throw new NotFoundException('Ausencia no encontrada');
    }

    if (absence.status !== 'PENDING') {
      throw new BadRequestException(
        'Solo se pueden cancelar ausencias pendientes',
      );
    }

    const updated = await this.prisma.userAbsence.update({
      where: { id: absenceId },
      data: { status: 'CANCELLED' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return this.toAbsenceResponse(updated);
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  /**
   * Get all company absences (for admin/manager view)
   */
  async getAllAbsences(
    companyId: string,
    status?: AbsenceStatus,
    userId?: string,
  ): Promise<AbsenceResponse[]> {
    const absences = await this.prisma.userAbsence.findMany({
      where: {
        companyId,
        ...(status && { status }),
        ...(userId && { userId }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    });

    return absences.map((a) => this.toAbsenceResponse(a));
  }

  /**
   * Get a single absence by ID
   */
  async getAbsenceById(
    absenceId: string,
    companyId: string,
  ): Promise<AbsenceResponse> {
    const absence = await this.prisma.userAbsence.findFirst({
      where: {
        id: absenceId,
        companyId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!absence) {
      throw new NotFoundException('Ausencia no encontrada');
    }

    return this.toAbsenceResponse(absence);
  }

  /**
   * Review (approve/reject) an absence request
   */
  async reviewAbsence(
    absenceId: string,
    reviewerId: string,
    companyId: string,
    dto: ReviewAbsenceDto,
  ): Promise<AbsenceResponse> {
    const absence = await this.prisma.userAbsence.findFirst({
      where: {
        id: absenceId,
        companyId,
      },
    });

    if (!absence) {
      throw new NotFoundException('Ausencia no encontrada');
    }

    if (absence.status !== 'PENDING') {
      throw new BadRequestException(
        'Solo se pueden revisar ausencias pendientes',
      );
    }

    // Only allow APPROVED or REJECTED status from review
    if (dto.status !== 'APPROVED' && dto.status !== 'REJECTED') {
      throw new BadRequestException('El estado debe ser APPROVED o REJECTED');
    }

    const updated = await this.prisma.userAbsence.update({
      where: { id: absenceId },
      data: {
        status: dto.status,
        notes: dto.notes || absence.notes,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return this.toAbsenceResponse(updated);
  }

  /**
   * Get absence statistics for a company
   */
  async getAbsenceStats(companyId: string): Promise<AbsenceStats> {
    const counts = await this.prisma.userAbsence.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { status: true },
    });

    const stats: AbsenceStats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    };

    counts.forEach((c) => {
      const key = c.status.toLowerCase() as keyof AbsenceStats;
      stats[key] = c._count.status;
    });

    return stats;
  }

  /**
   * Get absences for a date range (used by calendar)
   */
  async getAbsencesInRange(
    companyId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<UserAbsence[]> {
    return this.prisma.userAbsence.findMany({
      where: {
        companyId,
        userId,
        status: 'APPROVED',
        OR: [
          {
            startDate: { lte: to },
            endDate: { gte: from },
          },
        ],
      },
      orderBy: { startDate: 'asc' },
    });
  }

  private toAbsenceResponse(
    absence: UserAbsence & {
      user?: { id: string; name: string; email: string };
      reviewedBy?: { id: string; name: string } | null;
    },
  ): AbsenceResponse {
    return {
      id: absence.id,
      userId: absence.userId,
      companyId: absence.companyId,
      startDate: absence.startDate,
      endDate: absence.endDate,
      type: absence.type,
      status: absence.status,
      notes: absence.notes,
      reviewedById: absence.reviewedById,
      reviewedAt: absence.reviewedAt,
      createdAt: absence.createdAt,
      user: absence.user,
      reviewedBy: absence.reviewedBy,
    };
  }
}
