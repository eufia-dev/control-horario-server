import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { WorkSchedule } from '@prisma/client';

// Average working days per month (considering weekends)
const AVG_WORKING_DAYS_PER_MONTH = 21.75;

@Injectable()
export class HourlyCostService {
  private readonly logger = new Logger(HourlyCostService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convert time string (HH:mm) to minutes
   */
  private timeToMinutes(time: string): number {
    const [hour, min] = time.split(':').map(Number);
    return hour * 60 + min;
  }

  /**
   * Get effective work schedules for a user (merges company defaults with user overrides)
   * This is a local implementation to avoid circular dependencies with WorkSchedulesService
   */
  private async getEffectiveWorkSchedules(
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
   * Calculate hourly cost from monthly salary based on work schedule
   * Formula: hourlyCost = salary / expectedMonthlyHours
   */
  async calculateHourlyCostFromSalary(
    companyId: string,
    userId: string,
    salary: number,
  ): Promise<number> {
    // Get user's effective work schedule (user override or company default)
    const schedules = await this.getEffectiveWorkSchedules(companyId, userId);

    // Calculate daily working hours from schedule
    let totalWeeklyMinutes = 0;
    let workableDays = 0;

    for (const schedule of schedules) {
      if (schedule.isWorkable) {
        const startMinutes = this.timeToMinutes(schedule.startTime);
        const endMinutes = this.timeToMinutes(schedule.endTime);
        let dailyMinutes = endMinutes - startMinutes;

        // Subtract break time if present
        if (schedule.breakStartTime && schedule.breakEndTime) {
          const breakStartMinutes = this.timeToMinutes(schedule.breakStartTime);
          const breakEndMinutes = this.timeToMinutes(schedule.breakEndTime);
          dailyMinutes -= breakEndMinutes - breakStartMinutes;
        }

        totalWeeklyMinutes += Math.max(0, dailyMinutes);
        workableDays++;
      }
    }

    if (workableDays === 0 || totalWeeklyMinutes === 0) {
      // Fallback: assume 8h/day, 5 days/week = 40h/week
      const monthlyHours = 40 * (AVG_WORKING_DAYS_PER_MONTH / 5);
      return Math.round((salary / monthlyHours) * 100) / 100;
    }

    // Calculate average daily hours
    const avgDailyMinutes = totalWeeklyMinutes / workableDays;
    const avgDailyHours = avgDailyMinutes / 60;

    // Calculate monthly hours
    const monthlyHours = avgDailyHours * AVG_WORKING_DAYS_PER_MONTH;

    // Calculate hourly cost (round to 2 decimals)
    return Math.round((salary / monthlyHours) * 100) / 100;
  }

  /**
   * Recalculate hourly cost for a user based on their salary and current schedule
   * Used when schedule changes and user has a salary set
   */
  async recalculateHourlyCostForUser(
    companyId: string,
    userId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
    });

    if (!user || user.salary === null) {
      return; // No salary set, nothing to recalculate
    }

    const hourlyCost = await this.calculateHourlyCostFromSalary(
      companyId,
      userId,
      Number(user.salary),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { hourlyCost },
    });

    this.logger.log(
      `Recalculated hourly cost for user ${userId}: ${hourlyCost}`,
    );
  }

  /**
   * Recalculate hourly costs for all users in a company that have salary set
   * Used when company default schedule changes
   */
  async recalculateHourlyCostsForCompany(companyId: string): Promise<void> {
    const usersWithSalary = await this.prisma.user.findMany({
      where: {
        companyId,
        salary: { not: null },
        deletedAt: null,
      },
      select: { id: true },
    });

    for (const user of usersWithSalary) {
      // Only recalculate for users using company default (no personal schedule)
      const hasPersonalSchedule = await this.prisma.workSchedule.findFirst({
        where: { companyId, userId: user.id },
      });

      if (!hasPersonalSchedule) {
        await this.recalculateHourlyCostForUser(companyId, user.id);
      }
    }
  }
}
