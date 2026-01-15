import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HourlyCostService } from '../hourly-cost/hourly-cost.service.js';
import type { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto.js';
import type {
  WorkScheduleResponse,
  WorkScheduleDayResponse,
} from './dto/work-schedule-response.dto.js';
import type { WorkSchedule } from '@prisma/client';

@Injectable()
export class WorkSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hourlyCostService: HourlyCostService,
  ) {}

  /**
   * Convert time string (HH:mm) to minutes
   */
  private timeToMinutes(time: string): number {
    const [hour, min] = time.split(':').map(Number);
    return hour * 60 + min;
  }

  /**
   * Validate that endTime > startTime
   */
  private validateTimeRange(startTime: string, endTime: string): void {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      throw new BadRequestException(
        'endTime must be greater than startTime for each day',
      );
    }
  }

  /**
   * Validate break times if provided
   * - Both breakStartTime and breakEndTime must be present together (or neither)
   * - breakEndTime must be greater than breakStartTime
   * - Break must be within work hours
   */
  private validateBreakRange(
    startTime: string,
    endTime: string,
    breakStartTime?: string,
    breakEndTime?: string,
  ): void {
    // If neither is provided, that's valid
    if (!breakStartTime && !breakEndTime) {
      return;
    }

    // If only one is provided, that's invalid
    if (!breakStartTime || !breakEndTime) {
      throw new BadRequestException(
        'Both breakStartTime and breakEndTime must be provided together, or neither',
      );
    }

    const workStart = this.timeToMinutes(startTime);
    const workEnd = this.timeToMinutes(endTime);
    const breakStart = this.timeToMinutes(breakStartTime);
    const breakEnd = this.timeToMinutes(breakEndTime);

    // Break end must be after break start
    if (breakEnd <= breakStart) {
      throw new BadRequestException(
        'breakEndTime must be greater than breakStartTime',
      );
    }

    // Break must be within work hours
    if (breakStart < workStart || breakEnd > workEnd) {
      throw new BadRequestException(
        'Break times must be within work hours (startTime to endTime)',
      );
    }
  }

  /**
   * Convert WorkSchedule array to response format
   */
  private schedulesToResponse(schedules: WorkSchedule[]): WorkScheduleResponse {
    const days: WorkScheduleDayResponse[] = schedules
      .map((s) => ({
        dayOfWeek: s.dayOfWeek,
        isWorkable: s.isWorkable,
        startTime: s.startTime,
        endTime: s.endTime,
        breakStartTime: s.breakStartTime ?? undefined,
        breakEndTime: s.breakEndTime ?? undefined,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    return { days };
  }

  /**
   * Get company default schedule
   */
  async getCompanyDefault(companyId: string): Promise<WorkScheduleResponse> {
    const schedules = await this.prisma.workSchedule.findMany({
      where: {
        companyId,
        userId: null,
      },
      orderBy: {
        dayOfWeek: 'asc',
      },
    });

    return this.schedulesToResponse(schedules);
  }

  /**
   * Get work schedules for a user (merges company defaults with user overrides per day)
   * Returns raw WorkSchedule array
   */
  async getWorkSchedules(
    companyId: string,
    userId: string,
  ): Promise<WorkSchedule[]> {
    // Load both defaults and overrides in parallel
    const [defaults, overrides] = await Promise.all([
      this.prisma.workSchedule.findMany({
        where: { companyId, userId: null },
      }),
      this.prisma.workSchedule.findMany({
        where: { companyId, userId },
      }),
    ]);

    // Merge: override wins if present for a day, otherwise use default
    const overrideMap = new Map<number, WorkSchedule>();
    overrides.forEach((o) => overrideMap.set(o.dayOfWeek, o));

    const effective: WorkSchedule[] = [];

    // Start with defaults, but replace with override if exists
    defaults.forEach((d) => {
      const override = overrideMap.get(d.dayOfWeek);
      effective.push(override || d);
    });

    // Also include overrides for days not in defaults
    overrides.forEach((o) => {
      if (!defaults.some((d) => d.dayOfWeek === o.dayOfWeek)) {
        effective.push(o);
      }
    });

    return effective;
  }

  /**
   * Get effective schedule for a user (merges defaults with overrides)
   */
  async getEffectiveSchedule(
    companyId: string,
    userId: string,
  ): Promise<WorkScheduleResponse> {
    const effective = await this.getWorkSchedules(companyId, userId);
    return this.schedulesToResponse(effective);
  }

  /**
   * Update company default schedule (admin only)
   */
  async updateCompanyDefault(
    companyId: string,
    dto: UpdateWorkScheduleDto,
  ): Promise<WorkScheduleResponse> {
    // Validate all time ranges and break times (only for workable days)
    for (const day of dto.days) {
      const isWorkable = day.isWorkable !== false; // default to true
      if (isWorkable) {
        if (!day.startTime || !day.endTime) {
          throw new BadRequestException(
            `startTime and endTime are required for workable days (dayOfWeek: ${day.dayOfWeek})`,
          );
        }
        this.validateTimeRange(day.startTime, day.endTime);
        this.validateBreakRange(
          day.startTime,
          day.endTime,
          day.breakStartTime,
          day.breakEndTime,
        );
      }
    }

    // Check for duplicate dayOfWeek values
    const daySet = new Set<number>();
    for (const day of dto.days) {
      if (daySet.has(day.dayOfWeek)) {
        throw new BadRequestException(
          `Duplicate dayOfWeek: ${day.dayOfWeek}. Each day can only appear once.`,
        );
      }
      daySet.add(day.dayOfWeek);
    }

    // Use transaction to replace all defaults atomically
    await this.prisma.$transaction(async (tx) => {
      // Delete existing defaults
      await tx.workSchedule.deleteMany({
        where: {
          companyId,
          userId: null,
        },
      });

      // Insert new defaults
      if (dto.days.length > 0) {
        await tx.workSchedule.createMany({
          data: dto.days.map((day) => {
            const isWorkable = day.isWorkable !== false;
            return {
              companyId,
              userId: null,
              dayOfWeek: day.dayOfWeek,
              isWorkable,
              // Use placeholder values for non-workable days
              startTime: day.startTime ?? '00:00',
              endTime: day.endTime ?? '00:00',
              breakStartTime: isWorkable ? (day.breakStartTime ?? null) : null,
              breakEndTime: isWorkable ? (day.breakEndTime ?? null) : null,
            };
          }),
        });
      }
    });

    // Recalculate hourly costs for users using company default schedule
    await this.hourlyCostService.recalculateHourlyCostsForCompany(companyId);

    return this.getCompanyDefault(companyId);
  }

  /**
   * Update user's schedule overrides (user can only edit if allowed)
   */
  async updateUserOverrides(
    companyId: string,
    userId: string,
    dto: UpdateWorkScheduleDto,
    allowUserEdit: boolean,
  ): Promise<WorkScheduleResponse> {
    if (!allowUserEdit) {
      throw new ForbiddenException(
        'No tienes permiso para editar tu horario. Contacta con un administrador.',
      );
    }

    // Validate all time ranges and break times (only for workable days)
    for (const day of dto.days) {
      const isWorkable = day.isWorkable !== false; // default to true
      if (isWorkable) {
        if (!day.startTime || !day.endTime) {
          throw new BadRequestException(
            `startTime and endTime are required for workable days (dayOfWeek: ${day.dayOfWeek})`,
          );
        }
        this.validateTimeRange(day.startTime, day.endTime);
        this.validateBreakRange(
          day.startTime,
          day.endTime,
          day.breakStartTime,
          day.breakEndTime,
        );
      }
    }

    // Check for duplicate dayOfWeek values
    const daySet = new Set<number>();
    for (const day of dto.days) {
      if (daySet.has(day.dayOfWeek)) {
        throw new BadRequestException(
          `Duplicate dayOfWeek: ${day.dayOfWeek}. Each day can only appear once.`,
        );
      }
      daySet.add(day.dayOfWeek);
    }

    // Verify user exists and belongs to company
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Use transaction to replace all overrides atomically
    await this.prisma.$transaction(async (tx) => {
      // Delete existing overrides
      await tx.workSchedule.deleteMany({
        where: {
          companyId,
          userId,
        },
      });

      // Insert new overrides
      if (dto.days.length > 0) {
        await tx.workSchedule.createMany({
          data: dto.days.map((day) => {
            const isWorkable = day.isWorkable !== false;
            return {
              companyId,
              userId,
              dayOfWeek: day.dayOfWeek,
              isWorkable,
              // Use placeholder values for non-workable days
              startTime: day.startTime ?? '00:00',
              endTime: day.endTime ?? '00:00',
              breakStartTime: isWorkable ? (day.breakStartTime ?? null) : null,
              breakEndTime: isWorkable ? (day.breakEndTime ?? null) : null,
            };
          }),
        });
      }
    });

    // Recalculate hourly cost for this user
    await this.hourlyCostService.recalculateHourlyCostForUser(
      companyId,
      userId,
    );

    return this.getEffectiveSchedule(companyId, userId);
  }

  /**
   * Delete all user overrides (user can only delete if allowed)
   */
  async deleteUserOverrides(
    companyId: string,
    userId: string,
    allowUserEdit: boolean,
  ): Promise<void> {
    if (!allowUserEdit) {
      throw new ForbiddenException(
        'No tienes permiso para editar tu horario. Contacta con un administrador.',
      );
    }

    // Verify user exists and belongs to company
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.prisma.workSchedule.deleteMany({
      where: {
        companyId,
        userId,
      },
    });

    // Recalculate hourly cost for this user (now using company defaults)
    await this.hourlyCostService.recalculateHourlyCostForUser(
      companyId,
      userId,
    );
  }

  /**
   * Update user's schedule overrides (admin can edit any user)
   */
  async updateUserOverridesByAdmin(
    companyId: string,
    targetUserId: string,
    dto: UpdateWorkScheduleDto,
  ): Promise<WorkScheduleResponse> {
    // Validate all time ranges and break times (only for workable days)
    for (const day of dto.days) {
      const isWorkable = day.isWorkable !== false; // default to true
      if (isWorkable) {
        if (!day.startTime || !day.endTime) {
          throw new BadRequestException(
            `startTime and endTime are required for workable days (dayOfWeek: ${day.dayOfWeek})`,
          );
        }
        this.validateTimeRange(day.startTime, day.endTime);
        this.validateBreakRange(
          day.startTime,
          day.endTime,
          day.breakStartTime,
          day.breakEndTime,
        );
      }
    }

    // Check for duplicate dayOfWeek values
    const daySet = new Set<number>();
    for (const day of dto.days) {
      if (daySet.has(day.dayOfWeek)) {
        throw new BadRequestException(
          `Duplicate dayOfWeek: ${day.dayOfWeek}. Each day can only appear once.`,
        );
      }
      daySet.add(day.dayOfWeek);
    }

    // Verify user exists and belongs to company
    const user = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Use transaction to replace all overrides atomically
    await this.prisma.$transaction(async (tx) => {
      // Delete existing overrides
      await tx.workSchedule.deleteMany({
        where: {
          companyId,
          userId: targetUserId,
        },
      });

      // Insert new overrides
      if (dto.days.length > 0) {
        await tx.workSchedule.createMany({
          data: dto.days.map((day) => {
            const isWorkable = day.isWorkable !== false;
            return {
              companyId,
              userId: targetUserId,
              dayOfWeek: day.dayOfWeek,
              isWorkable,
              // Use placeholder values for non-workable days
              startTime: day.startTime ?? '00:00',
              endTime: day.endTime ?? '00:00',
              breakStartTime: isWorkable ? (day.breakStartTime ?? null) : null,
              breakEndTime: isWorkable ? (day.breakEndTime ?? null) : null,
            };
          }),
        });
      }
    });

    // Recalculate hourly cost for this user
    await this.hourlyCostService.recalculateHourlyCostForUser(
      companyId,
      targetUserId,
    );

    return this.getEffectiveSchedule(companyId, targetUserId);
  }

  /**
   * Delete all user overrides (admin can delete any user's overrides)
   */
  async deleteUserOverridesByAdmin(
    companyId: string,
    targetUserId: string,
  ): Promise<void> {
    // Verify user exists and belongs to company
    const user = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.prisma.workSchedule.deleteMany({
      where: {
        companyId,
        userId: targetUserId,
      },
    });

    // Recalculate hourly cost for this user (now using company defaults)
    await this.hourlyCostService.recalculateHourlyCostForUser(
      companyId,
      targetUserId,
    );
  }
}
