import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HolidaysService } from '../holidays/holidays.service.js';
import { AbsencesService } from '../absences/absences.service.js';
import { TimeEntriesService } from '../time-entries/time-entries.service.js';
import { WorkSchedulesService } from '../work-schedules/work-schedules.service.js';
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
    private readonly timeEntriesService: TimeEntriesService,
    private readonly workSchedulesService: WorkSchedulesService,
  ) {}

  async getCalendar(
    companyId: string,
    userId: string,
    from: string,
    to: string,
  ): Promise<CalendarResponse> {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const [user, location] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, companyId },
      }),
      this.prisma.companyLocation.findUnique({
        where: { companyId },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const schedulesPromise = this.workSchedulesService.getWorkSchedules(
      companyId,
      userId,
    );

    const publicHolidaysPromise = location
      ? this.holidaysService.getPublicHolidaysInRange(
          location.regionCode,
          fromDate,
          toDate,
        )
      : Promise.resolve([]);

    const companyHolidaysPromise =
      this.holidaysService.getCompanyHolidaysInRange(
        companyId,
        fromDate,
        toDate,
      );

    const absencesPromise = this.absencesService.getAbsencesInRange(
      companyId,
      userId,
      fromDate,
      toDate,
    );

    const timeEntriesPromise = this.timeEntriesService.getTimeEntriesInRange(
      companyId,
      userId,
      fromDate,
      toDate,
    );

    // Everything below is independent, so resolve simultaneously
    const [schedules, publicHolidays, companyHolidays, absences, timeEntries] =
      await Promise.all([
        schedulesPromise,
        publicHolidaysPromise,
        companyHolidaysPromise,
        absencesPromise,
        timeEntriesPromise,
      ]);

    // Build calendar days
    const days = this.buildCalendarDays(
      fromDate,
      toDate,
      schedules,
      publicHolidays,
      companyHolidays,
      absences,
      timeEntries,
      user.createdAt,
    );

    // Calculate summary
    const summary = this.calculateSummary(days);

    return {
      userId: user.id,
      userName: user.name,
      from: from,
      to: to,
      days,
      summary,
    };
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
    userCreatedAt: Date,
  ): CalendarDay[] {
    const days: CalendarDay[] = [];

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

    const currentDate = new Date(from);
    while (currentDate <= to) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const dayOfWeek = (currentDate.getUTCDay() + 6) % 7; // 0 = Monday ... 6 = Sunday
      const schedule = scheduleMap.get(dayOfWeek);

      const publicHoliday = publicHolidayMap.get(dateKey);
      const companyHoliday = companyHolidayMap.get(dateKey);
      const absence = absences.find(
        (a) => currentDate >= a.startDate && currentDate <= a.endDate,
      );

      const dayEntries = entriesByDate.get(dateKey) || [];
      const loggedMinutes = dayEntries.reduce(
        (sum, e) => sum + e.durationMinutes,
        0,
      );

      const expectedMinutes = this.calculateExpectedMinutes(schedule);

      const { status, holidayName, absenceType, isOvertime } =
        this.determineStatus(
          currentDate,
          userCreatedAt,
          publicHoliday,
          companyHoliday,
          absence,
          schedule,
          loggedMinutes,
          expectedMinutes,
        );

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

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return days;
  }

  private calculateExpectedMinutes(schedule?: WorkSchedule): number {
    if (!schedule) {
      return 0;
    }

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
    userCreatedAt: Date,
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
    const today = new Date();

    if (date < userCreatedAt) {
      return { status: 'BEFORE_USER_CREATED' };
    }

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
      // Only show absence if it's a workday (has schedule)
      if (absence && schedule && expectedMinutes > 0) {
        return {
          status: 'ABSENCE',
          absenceType: absence.type,
        };
      }
      // Non-working day takes precedence over absence for future dates
      if (!schedule || expectedMinutes === 0) {
        return { status: 'FUTURE' };
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

    // Non-working day (no schedule for this day of week)
    // Non-working days take precedence over absences
    if (!schedule || expectedMinutes === 0) {
      return {
        status: 'NON_WORKING_DAY',
        isOvertime: loggedMinutes > 0,
      };
    }

    // Absence (only if it's a workday)
    if (absence) {
      return {
        status: 'ABSENCE',
        absenceType: absence.type,
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
      // Skip future days and days before user was created for most calculations
      if (day.status === 'FUTURE' || day.status === 'BEFORE_USER_CREATED') {
        continue;
      }

      totalLoggedMinutes += day.loggedMinutes;

      switch (day.status) {
        case 'PUBLIC_HOLIDAY':
        case 'COMPANY_HOLIDAY':
          publicHolidays++;
          break;
        case 'ABSENCE':
          // Only count as absence day if it's actually a workday
          // (status is ABSENCE only when there's a schedule, so it's a workday)
          absenceDays++;
          workingDays++;
          totalExpectedMinutes += day.expectedMinutes;
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
          // Don't count towards working days or absence days
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
