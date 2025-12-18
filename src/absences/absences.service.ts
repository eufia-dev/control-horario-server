import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAbsenceDto } from './dto/create-absence.dto.js';
import type { ReviewAbsenceDto } from './dto/review-absence.dto.js';
import { AbsenceType, AbsenceStatus, type UserAbsence } from '@prisma/client';
import type { HolidaysService } from '../holidays/holidays.service.js';
import { HolidaysService as HolidaysServiceClass } from '../holidays/holidays.service.js';

export interface AbsenceResponse {
  id: string;
  userId: string;
  companyId: string;
  startDate: Date;
  endDate: Date;
  type: AbsenceType;
  workdaysCount: number;
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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => HolidaysServiceClass))
    private readonly holidaysService: HolidaysService,
  ) {}

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

  async requestAbsence(
    userId: string,
    companyId: string,
    dto: CreateAbsenceDto,
  ): Promise<AbsenceResponse> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }

    const workdaysInRange = await this.countWorkdaysInRange(
      userId,
      companyId,
      startDate,
      endDate,
    );

    if (workdaysInRange === 0) {
      throw new BadRequestException(
        'El rango de fechas seleccionado no incluye ningún día laborable. Verifica que las fechas no sean fines de semana sin horario o días festivos.',
      );
    }

    const overlapping = await this.prisma.userAbsence.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: startDate },
        endDate: { gte: endDate },
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
        startDate: startDate,
        endDate: endDate,
        type: dto.type,
        workdaysCount: workdaysInRange,
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
        startDate: { lte: to },
        endDate: { gte: from },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async countWorkdaysInRange(
    userId: string,
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (await this.isWorkday(userId, companyId, current)) {
        count++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return count;
  }

  async isWorkday(
    userId: string,
    companyId: string,
    date: Date,
  ): Promise<boolean> {
    const dayOfWeek = (date.getUTCDay() + 6) % 7;

    const userSchedule = await this.prisma.workSchedule.findFirst({
      where: {
        companyId,
        userId,
        dayOfWeek,
      },
    });

    const schedule =
      userSchedule ||
      (await this.prisma.workSchedule.findFirst({
        where: {
          companyId,
          userId: null,
          dayOfWeek,
        },
      }));

    if (!schedule) {
      return false;
    }

    const isHoliday = await this.holidaysService.isHoliday(companyId, date);

    return !isHoliday;
  }

  async recheckAbsencesForCompany(companyId: string): Promise<void> {
    const absences = await this.prisma.userAbsence.findMany({
      where: {
        companyId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    for (const absence of absences) {
      const workdaysCount = await this.countWorkdaysInRange(
        absence.userId,
        companyId,
        absence.startDate,
        absence.endDate,
      );

      if (workdaysCount === 0) {
        await this.prisma.userAbsence.update({
          where: { id: absence.id },
          data: {
            status: 'CANCELLED',
            workdaysCount: 0,
            notes: absence.notes
              ? `${absence.notes}\n\n[Automático] Cancelada porque ya no incluye días laborables debido a cambios en festivos.`
              : '[Automático] Cancelada porque ya no incluye días laborables debido a cambios en festivos.',
          },
        });
      } else if (absence.workdaysCount !== workdaysCount) {
        await this.prisma.userAbsence.update({
          where: { id: absence.id },
          data: {
            workdaysCount,
          },
        });
      }
    }
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
      workdaysCount: absence.workdaysCount,
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
