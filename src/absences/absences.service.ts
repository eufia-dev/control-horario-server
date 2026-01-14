import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAbsenceDto } from './dto/create-absence.dto.js';
import type { ReviewAbsenceDto } from './dto/review-absence.dto.js';
import { AbsenceType, AbsenceStatus, type UserAbsence } from '@prisma/client';
import type { HolidaysService } from '../holidays/holidays.service.js';
import { HolidaysService as HolidaysServiceClass } from '../holidays/holidays.service.js';
import { EmailService } from '../email/email.service.js';

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

/**
 * Spanish display names for absence types
 */
const ABSENCE_TYPE_NAMES: Record<AbsenceType, string> = {
  [AbsenceType.VACATION]: 'Vacaciones',
  [AbsenceType.SICK_LEAVE_COMMON]: 'Baja por enfermedad común',
  [AbsenceType.SICK_LEAVE_PROFESSIONAL]: 'Baja por enfermedad profesional',
  [AbsenceType.ACCIDENT_LEAVE_NON_WORK]: 'Baja por accidente no laboral',
  [AbsenceType.ACCIDENT_LEAVE_WORK]: 'Baja por accidente de trabajo',
  [AbsenceType.PARENTAL_LEAVE]: 'Maternidad o paternidad',
  [AbsenceType.NURSING_LEAVE]: 'Lactancia',
  [AbsenceType.MARRIAGE]: 'Matrimonio',
  [AbsenceType.MOVING]: 'Mudanza',
  [AbsenceType.FAMILY_BEREAVEMENT_HOSPITALIZATION]:
    'Fallecimiento u hospitalización de familiar',
  [AbsenceType.TRAINING]: 'Formación',
  [AbsenceType.OTHER]: 'Otro (especificar en comentario)',
};

export interface GetAllAbsencesOptions {
  status?: AbsenceStatus;
  userId?: string;
  userIds?: string[] | null;
}

@Injectable()
export class AbsencesService {
  private readonly logger = new Logger(AbsencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => HolidaysServiceClass))
    private readonly holidaysService: HolidaysService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Get absence type enum values for frontend dropdown
   */
  getTypes(): AbsenceTypeOption[] {
    return Object.values(AbsenceType).map((value) => ({
      value,
      name: ABSENCE_TYPE_NAMES[value],
    }));
  }

  /**
   * Get absence type name in Spanish
   */
  private getAbsenceTypeName(type: AbsenceType): string {
    return ABSENCE_TYPE_NAMES[type];
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

    // Send email notifications to admins (non-blocking)
    this.notifyAdminsOfAbsenceRequest(absence).catch((error) => {
      this.logger.error(
        `Failed to send absence request notification emails: ${error}`,
      );
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
    options?: GetAllAbsencesOptions,
  ): Promise<AbsenceResponse[]> {
    const absences = await this.prisma.userAbsence.findMany({
      where: {
        companyId,
        ...(options?.status && { status: options.status }),
        ...(options?.userId && { userId: options.userId }),
        // Filter by userIds if provided (for team scope)
        ...(options?.userIds && { userId: { in: options.userIds } }),
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

    // Send email notification to user (non-blocking)
    this.notifyUserOfAbsenceReview(updated).catch((error) => {
      this.logger.error(
        `Failed to send absence review notification email: ${error}`,
      );
    });

    return this.toAbsenceResponse(updated);
  }

  async getAbsenceStats(
    companyId: string,
    userIds?: string[] | null,
  ): Promise<AbsenceStats> {
    const counts = await this.prisma.userAbsence.groupBy({
      by: ['status'],
      where: {
        companyId,
        // Filter by userIds if provided (for team scope)
        ...(userIds && { userId: { in: userIds } }),
      },
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

  /**
   * Notify admins and team leaders of a new absence request
   */
  private async notifyAdminsOfAbsenceRequest(
    absence: UserAbsence & {
      user: { id: string; name: string; email: string };
    },
  ): Promise<void> {
    if (!absence.user) {
      this.logger.warn(
        `Cannot send absence request notification: user data missing for absence ${absence.id}`,
      );
      return;
    }

    // Get company name
    const company = await this.prisma.company.findUnique({
      where: { id: absence.companyId },
      select: { name: true },
    });

    if (!company) {
      this.logger.warn(
        `Cannot send absence request notification: company ${absence.companyId} not found`,
      );
      return;
    }

    // Get the requesting user's teamId
    const requestingUser = await this.prisma.user.findUnique({
      where: { id: absence.userId },
      select: { teamId: true },
    });

    // Get all admins (OWNER or ADMIN roles)
    const admins = await this.prisma.user.findMany({
      where: {
        companyId: absence.companyId,
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

    // Get team leaders for the user's team (if user has a team)
    let teamLeaders: { id: string; name: string; email: string }[] = [];
    if (requestingUser?.teamId) {
      teamLeaders = await this.prisma.user.findMany({
        where: {
          companyId: absence.companyId,
          teamId: requestingUser.teamId,
          role: 'TEAM_LEADER',
          deletedAt: null,
          isActive: true,
          // Don't notify if the team leader is the one requesting the absence
          id: { not: absence.userId },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    }

    // Combine admins and team leaders, avoiding duplicates
    const adminIds = new Set(admins.map((a) => a.id));
    const recipients = [
      ...admins,
      ...teamLeaders.filter((tl) => !adminIds.has(tl.id)),
    ];

    if (recipients.length === 0) {
      this.logger.warn(
        `No admins or team leaders found for company ${absence.companyId} to notify about absence request`,
      );
      return;
    }

    const absenceTypeName = this.getAbsenceTypeName(absence.type);
    const startDateStr = absence.startDate.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const endDateStr = absence.endDate.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Send email to each recipient (admin or team leader)
    const emailPromises = recipients.map((recipient) =>
      this.emailService.sendAbsenceRequestNotification({
        to: recipient.email,
        adminName: recipient.name,
        userName: absence.user.name,
        companyName: company.name,
        absenceType: absenceTypeName,
        startDate: startDateStr,
        endDate: endDateStr,
        workdaysCount: absence.workdaysCount,
        notes: absence.notes,
        absenceId: absence.id,
      }),
    );

    await Promise.allSettled(emailPromises);
  }

  /**
   * Notify user of absence review (approved/rejected)
   */
  private async notifyUserOfAbsenceReview(
    absence: UserAbsence & {
      user: { id: string; name: string; email: string };
      reviewedBy?: { id: string; name: string } | null;
    },
  ): Promise<void> {
    if (!absence.user) {
      this.logger.warn(
        `Cannot send absence review notification: user data missing for absence ${absence.id}`,
      );
      return;
    }

    if (!absence.reviewedBy) {
      this.logger.warn(
        `Cannot send absence review notification: reviewer data missing for absence ${absence.id}`,
      );
      return;
    }

    if (absence.status !== 'APPROVED' && absence.status !== 'REJECTED') {
      // Only send notifications for approved/rejected statuses
      return;
    }

    // Get company name
    const company = await this.prisma.company.findUnique({
      where: { id: absence.companyId },
      select: { name: true },
    });

    if (!company) {
      this.logger.warn(
        `Cannot send absence review notification: company ${absence.companyId} not found`,
      );
      return;
    }

    const absenceTypeName = this.getAbsenceTypeName(absence.type);
    const startDateStr = absence.startDate.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const endDateStr = absence.endDate.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    await this.emailService.sendAbsenceReviewNotification({
      to: absence.user.email,
      userName: absence.user.name,
      companyName: company.name,
      absenceType: absenceTypeName,
      startDate: startDateStr,
      endDate: endDateStr,
      status: absence.status,
      reviewerName: absence.reviewedBy.name,
      notes: absence.notes,
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
