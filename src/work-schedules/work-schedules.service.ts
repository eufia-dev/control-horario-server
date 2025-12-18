import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto.js';
import type {
  WorkScheduleResponse,
  WorkScheduleDayResponse,
} from './dto/work-schedule-response.dto.js';
import type { WorkSchedule } from '@prisma/client';

@Injectable()
export class WorkSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that endTime > startTime
   */
  private validateTimeRange(startTime: string, endTime: string): void {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      throw new BadRequestException(
        'endTime must be greater than startTime for each day',
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
        startTime: s.startTime,
        endTime: s.endTime,
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
    // Validate all time ranges
    for (const day of dto.days) {
      this.validateTimeRange(day.startTime, day.endTime);
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
          data: dto.days.map((day) => ({
            companyId,
            userId: null,
            dayOfWeek: day.dayOfWeek,
            startTime: day.startTime,
            endTime: day.endTime,
          })),
        });
      }
    });

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

    // Validate all time ranges
    for (const day of dto.days) {
      this.validateTimeRange(day.startTime, day.endTime);
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
          data: dto.days.map((day) => ({
            companyId,
            userId,
            dayOfWeek: day.dayOfWeek,
            startTime: day.startTime,
            endTime: day.endTime,
          })),
        });
      }
    });

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
  }

  /**
   * Update user's schedule overrides (admin can edit any user)
   */
  async updateUserOverridesByAdmin(
    companyId: string,
    targetUserId: string,
    dto: UpdateWorkScheduleDto,
  ): Promise<WorkScheduleResponse> {
    // Validate all time ranges
    for (const day of dto.days) {
      this.validateTimeRange(day.startTime, day.endTime);
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
          data: dto.days.map((day) => ({
            companyId,
            userId: targetUserId,
            dayOfWeek: day.dayOfWeek,
            startTime: day.startTime,
            endTime: day.endTime,
          })),
        });
      }
    });

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
  }
}
