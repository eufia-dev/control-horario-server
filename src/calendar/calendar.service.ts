import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HolidaysService } from '../holidays/holidays.service.js';
import { AbsencesService } from '../absences/absences.service.js';
import type {
  CalendarDay,
  CalendarSummary,
  CalendarResponse,
  DayStatus,
  TimeEntryBrief,
} from './dto/calendar-day.dto.js';
import type {
  WorkSchedule,
  TimeEntry,
  PublicHoliday,
  CompanyHoliday,
  UserAbsence,
} from '@prisma/client';

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
    private readonly absencesService: AbsencesService,
  ) {}

  /**
   * Get calendar with computed day statuses for a user
   */
  async getCalendar(
    companyId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<CalendarResponse> {
    // Get user info
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Get company location for regional holidays
    const location = await this.prisma.companyLocation.findUnique({
      where: { companyId },
    });

    // Get work schedules (user-specific or company default)
    const schedules = await this.getWorkSchedules(companyId, userId);

    // Get public holidays in range
    const publicHolidays = location
      ? await this.holidaysService.getPublicHolidaysInRange(
          location.regionCode,
          from,
          to,
        )
      : [];

    // Get company custom holidays in range
    const companyHolidays =
      await this.holidaysService.getCompanyHolidaysInRange(companyId, from, to);

    // Get user absences (approved only) in range
    const absences = await this.absencesService.getAbsencesInRange(
      companyId,
      userId,
      from,
      to,
    );

    // Get time entries in range
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        userId,
        companyId,
        startTime: { gte: from, lte: to },
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // Build calendar days
    const days = this.buildCalendarDays(
      from,
      to,
      schedules,
      publicHolidays,
      companyHolidays,
      absences,
      timeEntries,
    );

    // Calculate summary
    const summary = this.calculateSummary(days);

    return {
      userId: user.id,
      userName: user.name,
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
      days,
      summary,
    };
  }

  /**
   * Get work schedules for a user (user-specific or company default)
   */
  private async getWorkSchedules(
    companyId: string,
    userId: string,
  ): Promise<WorkSchedule[]> {
    // First try to get user-specific schedules
    let schedules = await this.prisma.workSchedule.findMany({
      where: { companyId, userId },
    });

    // If no user-specific schedules, get company defaults
    if (schedules.length === 0) {
      schedules = await this.prisma.workSchedule.findMany({
        where: { companyId, userId: null },
      });
    }

    return schedules;
  }

  /**
   * Build array of calendar days with computed status
   */
  private buildCalendarDays(
    from: Date,
    to: Date,
    schedules: WorkSchedule[],
    publicHolidays: PublicHoliday[],
    companyHolidays: CompanyHoliday[],
    absences: UserAbsence[],
    timeEntries: (TimeEntry & {
      project: { id: string; name: string } | null;
    })[],
  ): CalendarDay[] {
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create maps for quick lookup
    const publicHolidayMap = new Map<string, PublicHoliday>();
    publicHolidays.forEach((h) => {
      const dateKey = h.date.toISOString().split('T')[0];
      publicHolidayMap.set(dateKey, h);
    });

    const companyHolidayMap = new Map<string, CompanyHoliday>();
    companyHolidays.forEach((h) => {
      const dateKey = h.date.toISOString().split('T')[0];
      companyHolidayMap.set(dateKey, h);
    });

    // Create schedule map by day of week
    const scheduleMap = new Map<number, WorkSchedule>();
    schedules.forEach((s) => {
      scheduleMap.set(s.dayOfWeek, s);
    });

    // Group time entries by date
    const entriesByDate = new Map<
      string,
      (TimeEntry & { project: { id: string; name: string } | null })[]
    >();
    timeEntries.forEach((e) => {
      const dateKey = e.startTime.toISOString().split('T')[0];
      const existing = entriesByDate.get(dateKey) || [];
      existing.push(e);
      entriesByDate.set(dateKey, existing);
    });

    // Iterate through each day in range
    const currentDate = new Date(from);
    while (currentDate <= to) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday
      const schedule = scheduleMap.get(dayOfWeek);

      // Check if this date is a public holiday
      const publicHoliday = publicHolidayMap.get(dateKey);

      // Check if this date is a company holiday
      const companyHoliday = companyHolidayMap.get(dateKey);

      // Check if this date falls within an absence
      const absence = absences.find(
        (a) => currentDate >= a.startDate && currentDate <= a.endDate,
      );

      // Get time entries for this date
      const dayEntries = entriesByDate.get(dateKey) || [];
      const loggedMinutes = dayEntries.reduce(
        (sum, e) => sum + e.durationMinutes,
        0,
      );

      // Calculate expected minutes from schedule
      const expectedMinutes = this.calculateExpectedMinutes(schedule);

      // Determine day status
      const { status, holidayName, absenceType, isOvertime } =
        this.determineStatus(
          currentDate,
          today,
          publicHoliday,
          companyHoliday,
          absence,
          schedule,
          loggedMinutes,
          expectedMinutes,
        );

      // Build time entry briefs
      const entryBriefs: TimeEntryBrief[] = dayEntries.map((e) => ({
        id: e.id,
        startTime: e.startTime,
        endTime: e.endTime,
        durationMinutes: e.durationMinutes,
        entryType: e.entryType,
        projectId: e.project?.id || null,
        projectName: e.project?.name || null,
      }));

      days.push({
        date: dateKey,
        dayOfWeek,
        status,
        holidayName,
        absenceType,
        expectedMinutes,
        loggedMinutes,
        entries: entryBriefs,
        isOvertime,
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }

  /**
   * Calculate expected work minutes from a schedule
   */
  private calculateExpectedMinutes(schedule?: WorkSchedule): number {
    if (!schedule) {
      return 0;
    }

    // Parse time strings (format: "HH:mm")
    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return Math.max(0, endMinutes - startMinutes);
  }

  /**
   * Determine the status of a day based on various factors
   */
  private determineStatus(
    date: Date,
    today: Date,
    publicHoliday: PublicHoliday | undefined,
    companyHoliday: CompanyHoliday | undefined,
    absence: UserAbsence | undefined,
    schedule: WorkSchedule | undefined,
    loggedMinutes: number,
    expectedMinutes: number,
  ): {
    status: DayStatus;
    holidayName?: string;
    absenceType?: UserAbsence['type'];
    isOvertime?: boolean;
  } {
    // Future dates
    if (date > today) {
      // Still show holidays/absences for future dates
      if (publicHoliday) {
        return {
          status: 'PUBLIC_HOLIDAY',
          holidayName: publicHoliday.localName || publicHoliday.name,
        };
      }
      if (companyHoliday) {
        return {
          status: 'COMPANY_HOLIDAY',
          holidayName: companyHoliday.name,
        };
      }
      if (absence) {
        return {
          status: 'ABSENCE',
          absenceType: absence.type,
        };
      }
      return { status: 'FUTURE' };
    }

    // Public holiday
    if (publicHoliday) {
      return {
        status: 'PUBLIC_HOLIDAY',
        holidayName: publicHoliday.localName || publicHoliday.name,
        isOvertime: loggedMinutes > 0,
      };
    }

    // Company holiday
    if (companyHoliday) {
      return {
        status: 'COMPANY_HOLIDAY',
        holidayName: companyHoliday.name,
        isOvertime: loggedMinutes > 0,
      };
    }

    // Absence
    if (absence) {
      return {
        status: 'ABSENCE',
        absenceType: absence.type,
        isOvertime: loggedMinutes > 0,
      };
    }

    // Non-working day (no schedule for this day of week)
    if (!schedule || expectedMinutes === 0) {
      return {
        status: 'NON_WORKING_DAY',
        isOvertime: loggedMinutes > 0,
      };
    }

    // Working day - check if worked
    if (loggedMinutes === 0) {
      return { status: 'MISSING_LOGS' };
    }

    // Partially worked (logged less than 80% of expected)
    if (loggedMinutes < expectedMinutes * 0.8) {
      return { status: 'PARTIALLY_WORKED' };
    }

    return { status: 'WORKED' };
  }

  /**
   * Calculate summary statistics from calendar days
   */
  private calculateSummary(days: CalendarDay[]): CalendarSummary {
    let workingDays = 0;
    let daysWorked = 0;
    let daysMissing = 0;
    let publicHolidays = 0;
    let absenceDays = 0;
    let totalExpectedMinutes = 0;
    let totalLoggedMinutes = 0;

    for (const day of days) {
      // Skip future days for most calculations
      if (day.status === 'FUTURE') {
        continue;
      }

      totalLoggedMinutes += day.loggedMinutes;

      switch (day.status) {
        case 'PUBLIC_HOLIDAY':
        case 'COMPANY_HOLIDAY':
          publicHolidays++;
          break;
        case 'ABSENCE':
          absenceDays++;
          break;
        case 'WORKED':
        case 'PARTIALLY_WORKED':
          workingDays++;
          daysWorked++;
          totalExpectedMinutes += day.expectedMinutes;
          break;
        case 'MISSING_LOGS':
          workingDays++;
          daysMissing++;
          totalExpectedMinutes += day.expectedMinutes;
          break;
        case 'NON_WORKING_DAY':
          // Don't count towards working days
          break;
      }
    }

    // Calculate compliance percentage
    const compliancePercentage =
      totalExpectedMinutes > 0
        ? Math.round((totalLoggedMinutes / totalExpectedMinutes) * 100)
        : 100;

    return {
      workingDays,
      daysWorked,
      daysMissing,
      publicHolidays,
      absenceDays,
      totalExpectedMinutes,
      totalLoggedMinutes,
      compliancePercentage: Math.min(100, compliancePercentage),
    };
  }
}
