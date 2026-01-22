import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkSchedulesService } from '../work-schedules/work-schedules.service.js';
import { HolidaysService } from '../holidays/holidays.service.js';
import { AbsencesService } from '../absences/absences.service.js';
import { TimeEntriesService } from '../time-entries/time-entries.service.js';
import type {
  ProjectsSummaryResponse,
  ProjectSummaryItem,
} from './dto/projects-summary.dto.js';
import type {
  ProjectBreakdownResponse,
  WorkerBreakdownItem,
} from './dto/project-breakdown.dto.js';
import type {
  WorkersSummaryResponse,
  WorkerSummaryItem,
} from './dto/workers-summary.dto.js';
import type { WorkerBreakdownResponse } from './dto/worker-breakdown.dto.js';
import type {
  PayrollSummaryResponse,
  PayrollUserSummary,
  PayrollSummaryTotals,
} from './dto/payroll-summary.dto.js';
import type {
  WorkSchedule,
  PublicHoliday,
  CompanyHoliday,
  TimeEntry,
  UserAbsence,
} from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workSchedulesService: WorkSchedulesService,
    private readonly holidaysService: HolidaysService,
    private readonly absencesService: AbsencesService,
    private readonly timeEntriesService: TimeEntriesService,
  ) {}

  /**
   * Round a number to 2 decimal places
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Calculate cost from minutes and hourly rate
   */
  private calculateCost(minutes: number, hourlyCost: number): number {
    return this.roundToTwoDecimals((minutes / 60) * hourlyCost);
  }

  /**
   * Convert a Date to a YYYY-MM-DD string key
   */
  private toDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * GET /analytics/projects-summary
   * Returns aggregated data for all active projects
   * When teamId is provided (team leader case), only returns projects assigned to that team
   * When userIds is provided, only includes time entries from those users
   */
  async getProjectsSummary(
    companyId: string,
    options?: { userIds?: string[] | null; teamId?: string | null },
  ): Promise<ProjectsSummaryResponse> {
    // Get projects based on scope
    const projects = await this.prisma.project.findMany({
      where: {
        isActive: true,
        companyId,
        // For team leaders: only get projects assigned to their team
        ...(options?.teamId && { teamId: options.teamId }),
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    // Get project IDs for filtering time entries
    const projectIds = projects.map((p) => p.id);

    // Get all time entries with user hourly costs (single query for both minutes and cost)
    const timeEntriesWithCosts = await this.prisma.timeEntry.findMany({
      where: {
        companyId,
        projectId: { in: projectIds },
        project: {
          isActive: true,
        },
        // Filter by userIds if provided (for team scope)
        ...(options?.userIds && { userId: { in: options.userIds } }),
      },
      select: {
        projectId: true,
        durationMinutes: true,
        user: {
          select: {
            hourlyCost: true,
          },
        },
      },
    });

    // Build minutes and cost maps in a single pass
    const projectStats = new Map<string, { minutes: number; cost: number }>();
    timeEntriesWithCosts.forEach((entry) => {
      if (entry.projectId) {
        const current = projectStats.get(entry.projectId) || {
          minutes: 0,
          cost: 0,
        };
        current.minutes += entry.durationMinutes;
        current.cost +=
          (entry.durationMinutes / 60) * Number(entry.user.hourlyCost);
        projectStats.set(entry.projectId, current);
      }
    });

    // Build the response
    const projectSummaries: ProjectSummaryItem[] = projects.map((project) => {
      const stats = projectStats.get(project.id) || { minutes: 0, cost: 0 };

      return {
        id: project.id,
        name: project.name,
        code: project.code,
        totalMinutes: stats.minutes,
        totalCost: this.roundToTwoDecimals(stats.cost),
      };
    });

    // Sort by totalCost descending
    projectSummaries.sort((a, b) => b.totalCost - a.totalCost);

    return { projects: projectSummaries };
  }

  /**
   * GET /analytics/projects/:projectId/breakdown
   * Returns per-worker breakdown for a specific project
   * When teamId is provided, verifies project belongs to that team
   * When userIds is provided, only includes workers from that list
   */
  async getProjectBreakdown(
    projectId: string,
    companyId: string,
    options?: { userIds?: string[] | null; teamId?: string | null },
  ): Promise<ProjectBreakdownResponse> {
    // Verify project exists, belongs to company, and (if team-scoped) belongs to the team
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId,
        // For team leaders: verify project belongs to their team
        ...(options?.teamId && { teamId: options.teamId }),
      },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
    }

    // Get internal time entries grouped by user
    const internalEntries = await this.prisma.timeEntry.groupBy({
      by: ['userId'],
      where: {
        projectId,
        companyId,
        // Filter by userIds if provided (for team scope)
        ...(options?.userIds && { userId: { in: options.userIds } }),
      },
      _sum: {
        durationMinutes: true,
      },
    });

    // Get user details for internal workers
    const userIds = internalEntries.map((e) => e.userId);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        name: true,
        hourlyCost: true,
      },
    });

    const usersMap = new Map(users.map((u) => [u.id, u]));

    // Build workers array
    const workers: WorkerBreakdownItem[] = [];

    // Add workers
    internalEntries.forEach((entry) => {
      const user = usersMap.get(entry.userId);
      if (user) {
        const minutes = entry._sum.durationMinutes || 0;
        const hourlyCost = Number(user.hourlyCost);
        workers.push({
          id: user.id,
          name: user.name,
          minutes,
          hourlyCost,
          totalCost: this.calculateCost(minutes, hourlyCost),
        });
      }
    });

    // Sort by totalCost descending
    workers.sort((a, b) => b.totalCost - a.totalCost);

    return { workers };
  }

  /**
   * GET /analytics/workers-summary
   * Returns aggregated data for all active workers (internal users only)
   */
  async getWorkersSummary(
    companyId: string,
    options?: { userIds?: string[] | null },
  ): Promise<WorkersSummaryResponse> {
    // Run both queries in parallel for better latency
    const [activeUsers, userTimeEntries] = await Promise.all([
      // Get all active internal users
      this.prisma.user.findMany({
        where: {
          companyId,
          isActive: true,
          // Filter by userIds if provided (for team scope)
          ...(options?.userIds && { id: { in: options.userIds } }),
        },
        select: {
          id: true,
          name: true,
          hourlyCost: true,
        },
      }),
      // Get time entries grouped by user
      this.prisma.timeEntry.groupBy({
        by: ['userId'],
        where: {
          companyId,
          user: {
            isActive: true,
            // Filter by userIds if provided (for team scope)
            ...(options?.userIds && { id: { in: options.userIds } }),
          },
        },
        _sum: {
          durationMinutes: true,
        },
      }),
    ]);

    const userMinutesMap = new Map<string, number>();
    userTimeEntries.forEach((entry) => {
      userMinutesMap.set(entry.userId, entry._sum.durationMinutes || 0);
    });

    // Build workers array
    const workers: WorkerSummaryItem[] = [];

    // Add users
    activeUsers.forEach((user) => {
      const totalMinutes = userMinutesMap.get(user.id) || 0;
      const hourlyCost = Number(user.hourlyCost);
      workers.push({
        id: user.id,
        name: user.name,
        hourlyCost,
        totalMinutes,
        totalCost: this.calculateCost(totalMinutes, hourlyCost),
      });
    });

    // Sort by totalMinutes descending
    workers.sort((a, b) => b.totalMinutes - a.totalMinutes);

    return { workers };
  }

  /**
   * GET /analytics/workers/:workerId/breakdown
   * Returns per-project breakdown for a specific worker
   */
  async getWorkerBreakdown(
    userId: string,
    companyId: string,
  ): Promise<WorkerBreakdownResponse> {
    // Verify user exists and belongs to company
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
      select: {
        id: true,
        name: true,
        hourlyCost: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Get time entries grouped by project
    const timeEntries = await this.prisma.timeEntry.groupBy({
      by: ['projectId'],
      where: {
        userId,
        companyId,
      },
      _sum: {
        durationMinutes: true,
      },
    });

    // Get project details
    const projectIds = timeEntries
      .map((e) => e.projectId)
      .filter((id): id is string => id !== null);
    const projects = await this.prisma.project.findMany({
      where: {
        id: { in: projectIds },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    const projectsMap = new Map(projects.map((p) => [p.id, p]));
    const hourlyCost = Number(user.hourlyCost);

    // Build projects array
    const projectsBreakdown = timeEntries
      .map((entry) => {
        if (!entry.projectId) return null;
        const project = projectsMap.get(entry.projectId);
        if (!project) return null;

        const minutes = entry._sum.durationMinutes || 0;
        return {
          id: project.id,
          name: project.name,
          code: project.code,
          minutes,
          cost: this.calculateCost(minutes, hourlyCost),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Sort by minutes descending
    projectsBreakdown.sort((a, b) => b.minutes - a.minutes);

    return {
      worker: {
        id: user.id,
        name: user.name,
        hourlyCost,
      },
      projects: projectsBreakdown,
    };
  }

  /**
   * GET /analytics/payroll-summary
   * Returns payroll summary for all users in the given date range
   * Includes expected vs logged hours, absence breakdowns, and cost calculations
   *
   * Optimized to batch all database queries upfront (5 queries total regardless of user count)
   */
  async getPayrollSummary(
    companyId: string,
    startDate: string,
    endDate: string,
    options?: { userIds?: string[] | null },
  ): Promise<PayrollSummaryResponse> {
    const fromDate = new Date(startDate);
    const toDate = new Date(endDate);

    // Step 1: Fetch users and company location
    const [users, location] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          companyId,
          isActive: true,
          deletedAt: null,
          ...(options?.userIds && { id: { in: options.userIds } }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          hourlyCost: true,
          createdAt: true,
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.companyLocation.findUnique({
        where: { companyId },
      }),
    ]);

    // Early return if no users
    if (users.length === 0) {
      return {
        startDate,
        endDate,
        users: [],
        totals: {
          expectedMinutes: 0,
          loggedMinutes: 0,
          differenceMinutes: 0,
          vacationDays: 0,
          sickLeaveDays: 0,
          otherAbsenceDays: 0,
          totalCost: 0,
        },
      };
    }

    const userIds = users.map((u) => u.id);

    // Step 2: Batch fetch ALL data in parallel (5 queries total)
    const [
      publicHolidays,
      companyHolidays,
      companyDefaultSchedules,
      userScheduleOverrides,
      allAbsences,
      allTimeEntries,
    ] = await Promise.all([
      location
        ? this.holidaysService.getPublicHolidaysInRange(
            location.regionCode,
            fromDate,
            toDate,
          )
        : Promise.resolve([]),
      this.holidaysService.getCompanyHolidaysInRange(
        companyId,
        fromDate,
        toDate,
      ),
      this.prisma.workSchedule.findMany({
        where: { companyId, userId: null },
      }),
      this.prisma.workSchedule.findMany({
        where: { companyId, userId: { in: userIds } },
      }),
      this.prisma.userAbsence.findMany({
        where: {
          companyId,
          userId: { in: userIds },
          status: 'APPROVED',
          startDate: { lte: toDate },
          endDate: { gte: fromDate },
        },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          companyId,
          userId: { in: userIds },
          startTime: { gte: fromDate, lte: toDate },
        },
      }),
    ]);

    // Step 3: Build lookup maps for shared data
    const publicHolidayMap = new Map<string, PublicHoliday>();
    publicHolidays.forEach((h) => {
      publicHolidayMap.set(this.toDateKey(h.date), h);
    });

    const companyHolidayMap = new Map<string, CompanyHoliday>();
    companyHolidays.forEach((h) => {
      companyHolidayMap.set(this.toDateKey(h.date), h);
    });

    // Build default schedule map (shared across users)
    const defaultScheduleMap = new Map<number, WorkSchedule>();
    companyDefaultSchedules.forEach((s) =>
      defaultScheduleMap.set(s.dayOfWeek, s),
    );

    // Group user-specific data by userId
    const scheduleOverridesByUser = new Map<string, WorkSchedule[]>();
    userScheduleOverrides.forEach((s) => {
      if (s.userId) {
        const existing = scheduleOverridesByUser.get(s.userId) || [];
        existing.push(s);
        scheduleOverridesByUser.set(s.userId, existing);
      }
    });

    const absencesByUser = new Map<string, UserAbsence[]>();
    allAbsences.forEach((a) => {
      const existing = absencesByUser.get(a.userId) || [];
      existing.push(a);
      absencesByUser.set(a.userId, existing);
    });

    const entriesByUser = new Map<string, TimeEntry[]>();
    allTimeEntries.forEach((e) => {
      const existing = entriesByUser.get(e.userId) || [];
      existing.push(e);
      entriesByUser.set(e.userId, existing);
    });

    // Step 4: Process each user synchronously (no more DB calls)
    const userSummaries = users.map((user) => {
      // Merge default schedules with user overrides
      const userOverrides = scheduleOverridesByUser.get(user.id) || [];
      const overrideMap = new Map<number, WorkSchedule>();
      userOverrides.forEach((o) => overrideMap.set(o.dayOfWeek, o));

      const effectiveScheduleMap = new Map<number, WorkSchedule>();
      defaultScheduleMap.forEach((schedule, dayOfWeek) => {
        effectiveScheduleMap.set(
          dayOfWeek,
          overrideMap.get(dayOfWeek) || schedule,
        );
      });
      // Include any override days not in defaults
      userOverrides.forEach((o) => {
        if (!defaultScheduleMap.has(o.dayOfWeek)) {
          effectiveScheduleMap.set(o.dayOfWeek, o);
        }
      });

      return this.calculateUserPayrollSummaryFromData(
        user,
        fromDate,
        toDate,
        effectiveScheduleMap,
        absencesByUser.get(user.id) || [],
        entriesByUser.get(user.id) || [],
        publicHolidayMap,
        companyHolidayMap,
      );
    });

    // Calculate totals
    const totals = this.calculatePayrollTotals(userSummaries);

    // Sort by name
    userSummaries.sort((a, b) => a.name.localeCompare(b.name));

    return {
      startDate,
      endDate,
      users: userSummaries,
      totals,
    };
  }

  /**
   * Calculate payroll summary for a single user from pre-fetched data (no DB calls)
   */
  private calculateUserPayrollSummaryFromData(
    user: {
      id: string;
      name: string;
      email: string;
      hourlyCost: { toNumber(): number } | number;
      createdAt: Date;
      team: { id: string; name: string } | null;
    },
    fromDate: Date,
    toDate: Date,
    scheduleMap: Map<number, WorkSchedule>,
    absences: UserAbsence[],
    timeEntries: TimeEntry[],
    publicHolidayMap: Map<string, PublicHoliday>,
    companyHolidayMap: Map<string, CompanyHoliday>,
  ): PayrollUserSummary {
    // Group time entries by date
    const entriesByDate = new Map<string, TimeEntry[]>();
    timeEntries.forEach((e) => {
      const dateKey = this.toDateKey(e.startTime);
      const existing = entriesByDate.get(dateKey) || [];
      existing.push(e);
      entriesByDate.set(dateKey, existing);
    });

    // Pre-index absences by date for O(1) lookup (instead of O(n) find per day)
    const absenceByDate = new Map<string, UserAbsence>();
    absences.forEach((absence) => {
      const absenceStart = new Date(absence.startDate);
      const absenceEnd = new Date(absence.endDate);
      const indexDate = new Date(absenceStart);
      while (indexDate <= absenceEnd) {
        absenceByDate.set(this.toDateKey(indexDate), absence);
        indexDate.setUTCDate(indexDate.getUTCDate() + 1);
      }
    });

    // Initialize counters
    let expectedMinutes = 0;
    let loggedMinutes = 0;
    let expectedWorkDays = 0;
    let daysWorked = 0;
    let daysMissing = 0;
    let vacationDays = 0;
    let sickLeaveDays = 0;
    let otherAbsenceDays = 0;

    const today = new Date();
    const currentDate = new Date(fromDate);

    while (currentDate <= toDate) {
      const dateKey = this.toDateKey(currentDate);
      const dayOfWeek = (currentDate.getUTCDay() + 6) % 7; // 0 = Monday ... 6 = Sunday
      const schedule = scheduleMap.get(dayOfWeek);

      // Skip days before user was created
      if (currentDate < user.createdAt) {
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        continue;
      }

      // Skip future days
      if (currentDate > today) {
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        continue;
      }

      const publicHoliday = publicHolidayMap.get(dateKey);
      const companyHoliday = companyHolidayMap.get(dateKey);
      // O(1) lookup instead of O(n) find
      const absence = absenceByDate.get(dateKey);

      const dayEntries = entriesByDate.get(dateKey) || [];
      // Only count WORK entries toward logged time (exclude pauses)
      const dayLoggedMinutes = dayEntries
        .filter((e) => e.entryType === 'WORK')
        .reduce((sum, e) => sum + e.durationMinutes, 0);

      loggedMinutes += dayLoggedMinutes;

      const dayExpectedMinutes =
        this.calculateExpectedMinutesFromSchedule(schedule);

      // Determine day status and count appropriately
      if (publicHoliday || companyHoliday) {
        // Holiday - no expected work, but logged hours count as extra
        // Don't add to expected
      } else if (
        !schedule ||
        !schedule.isWorkable ||
        dayExpectedMinutes === 0
      ) {
        // Non-working day - no expected work
      } else if (absence) {
        // Absence on a working day
        if (absence.type === 'VACATION') {
          vacationDays++;
        } else if (absence.type.startsWith('SICK_LEAVE')) {
          sickLeaveDays++;
        } else {
          otherAbsenceDays++;
        }
        // Absences don't add to expected minutes (person is excused)
      } else {
        // Regular working day
        expectedMinutes += dayExpectedMinutes;
        expectedWorkDays++;

        if (dayLoggedMinutes > 0) {
          daysWorked++;
        } else {
          daysMissing++;
        }
      }

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    const hourlyCost =
      typeof user.hourlyCost === 'number'
        ? user.hourlyCost
        : user.hourlyCost.toNumber();

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      team: user.team,
      hourlyCost,
      expectedMinutes,
      loggedMinutes,
      differenceMinutes: loggedMinutes - expectedMinutes,
      expectedWorkDays,
      daysWorked,
      daysMissing,
      vacationDays,
      sickLeaveDays,
      otherAbsenceDays,
      totalCost: this.calculateCost(loggedMinutes, hourlyCost),
    };
  }

  /**
   * Calculate expected minutes from a work schedule
   */
  private calculateExpectedMinutesFromSchedule(
    schedule?: WorkSchedule,
  ): number {
    if (!schedule || !schedule.isWorkable) {
      return 0;
    }

    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    let totalMinutes = Math.max(0, endMinutes - startMinutes);

    // Subtract scheduled break duration if present
    if (schedule.breakStartTime && schedule.breakEndTime) {
      const [breakStartHour, breakStartMin] = schedule.breakStartTime
        .split(':')
        .map(Number);
      const [breakEndHour, breakEndMin] = schedule.breakEndTime
        .split(':')
        .map(Number);

      const breakStartMinutes = breakStartHour * 60 + breakStartMin;
      const breakEndMinutes = breakEndHour * 60 + breakEndMin;

      const breakDuration = Math.max(0, breakEndMinutes - breakStartMinutes);
      totalMinutes = Math.max(0, totalMinutes - breakDuration);
    }

    return totalMinutes;
  }

  /**
   * Calculate aggregate totals across all users
   */
  private calculatePayrollTotals(
    userSummaries: PayrollUserSummary[],
  ): PayrollSummaryTotals {
    return userSummaries.reduce(
      (totals, user) => ({
        expectedMinutes: totals.expectedMinutes + user.expectedMinutes,
        loggedMinutes: totals.loggedMinutes + user.loggedMinutes,
        differenceMinutes: totals.differenceMinutes + user.differenceMinutes,
        vacationDays: totals.vacationDays + user.vacationDays,
        sickLeaveDays: totals.sickLeaveDays + user.sickLeaveDays,
        otherAbsenceDays: totals.otherAbsenceDays + user.otherAbsenceDays,
        totalCost: this.roundToTwoDecimals(totals.totalCost + user.totalCost),
      }),
      {
        expectedMinutes: 0,
        loggedMinutes: 0,
        differenceMinutes: 0,
        vacationDays: 0,
        sickLeaveDays: 0,
        otherAbsenceDays: 0,
        totalCost: 0,
      },
    );
  }
}
