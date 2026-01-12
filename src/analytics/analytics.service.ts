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
   * GET /analytics/projects-summary
   * Returns aggregated data for all active projects
   * When teamId is provided (team leader case), only returns projects assigned to that team
   * When userIds is provided, only includes time entries from those users
   */
  async getProjectsSummary(
    companyId: string,
    options?: { userIds?: string[] | null; teamId?: string | null },
  ): Promise<ProjectsSummaryResponse> {
    // Check if we're filtering by team scope (team leader case)
    const isTeamScoped = !!options?.teamId;

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

    // Get internal time entries aggregated by project
    const internalTimeEntries = await this.prisma.timeEntry.groupBy({
      by: ['projectId'],
      where: {
        companyId,
        projectId: { in: projectIds },
        project: {
          isActive: true,
        },
        // Filter by userIds if provided (for team scope)
        ...(options?.userIds && { userId: { in: options.userIds } }),
      },
      _sum: {
        durationMinutes: true,
      },
    });

    // Get external hours aggregated by project (only for full admins)
    const externalHours = isTeamScoped
      ? []
      : await this.prisma.externalHours.groupBy({
          by: ['projectId'],
          where: {
            companyId,
            projectId: { in: projectIds },
            project: {
              isActive: true,
            },
          },
          _sum: {
            minutes: true,
          },
        });

    // Get all time entries with user hourly costs for cost calculation
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

    // Get all external hours with external hourly costs (only for full admins)
    const externalHoursWithCosts = isTeamScoped
      ? []
      : await this.prisma.externalHours.findMany({
          where: {
            companyId,
            projectId: { in: projectIds },
            project: {
              isActive: true,
            },
          },
          select: {
            projectId: true,
            minutes: true,
            externalWorker: {
              select: {
                hourlyCost: true,
              },
            },
          },
        });

    // Create lookup maps
    const internalMinutesMap = new Map<string, number>();
    internalTimeEntries.forEach((entry) => {
      if (entry.projectId) {
        internalMinutesMap.set(
          entry.projectId,
          entry._sum.durationMinutes || 0,
        );
      }
    });

    const externalMinutesMap = new Map<string, number>();
    externalHours.forEach((entry) => {
      externalMinutesMap.set(entry.projectId, entry._sum.minutes || 0);
    });

    // Calculate internal costs per project
    const internalCostMap = new Map<string, number>();
    timeEntriesWithCosts.forEach((entry) => {
      if (entry.projectId) {
        const currentCost = internalCostMap.get(entry.projectId) || 0;
        const entryCost =
          (entry.durationMinutes / 60) * Number(entry.user.hourlyCost);
        internalCostMap.set(entry.projectId, currentCost + entryCost);
      }
    });

    // Calculate external costs per project
    const externalCostMap = new Map<string, number>();
    externalHoursWithCosts.forEach((entry) => {
      const currentCost = externalCostMap.get(entry.projectId) || 0;
      const entryCost =
        (entry.minutes / 60) * Number(entry.externalWorker.hourlyCost);
      externalCostMap.set(entry.projectId, currentCost + entryCost);
    });

    // Build the response
    const projectSummaries: ProjectSummaryItem[] = projects.map((project) => {
      const internalMinutes = internalMinutesMap.get(project.id) || 0;
      const externalMinutes = externalMinutesMap.get(project.id) || 0;
      const internalCost = internalCostMap.get(project.id) || 0;
      const externalCost = externalCostMap.get(project.id) || 0;

      return {
        id: project.id,
        name: project.name,
        code: project.code,
        totalMinutes: internalMinutes + externalMinutes,
        internalMinutes,
        externalMinutes,
        totalCost: this.roundToTwoDecimals(internalCost + externalCost),
        internalCost: this.roundToTwoDecimals(internalCost),
        externalCost: this.roundToTwoDecimals(externalCost),
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
   * When userIds is provided, only includes workers from that list and excludes external workers
   */
  async getProjectBreakdown(
    projectId: string,
    companyId: string,
    options?: { userIds?: string[] | null; teamId?: string | null },
  ): Promise<ProjectBreakdownResponse> {
    // Check if we're filtering by team scope (team leader case)
    const isTeamScoped = !!options?.teamId;

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

    // Get external hours grouped by external worker (only for full admins)
    const externalEntries = isTeamScoped
      ? []
      : await this.prisma.externalHours.groupBy({
          by: ['externalWorkerId'],
          where: {
            projectId,
            companyId,
          },
          _sum: {
            minutes: true,
          },
        });

    // Get external worker details (only for full admins)
    const externalWorkerIds = externalEntries.map((e) => e.externalWorkerId);
    const externalWorkers = isTeamScoped
      ? []
      : await this.prisma.externalWorker.findMany({
          where: {
            id: { in: externalWorkerIds },
          },
          select: {
            id: true,
            name: true,
            hourlyCost: true,
          },
        });

    const externalWorkersMap = new Map(externalWorkers.map((e) => [e.id, e]));

    // Build workers array
    const workers: WorkerBreakdownItem[] = [];

    // Add internal workers
    internalEntries.forEach((entry) => {
      const user = usersMap.get(entry.userId);
      if (user) {
        const minutes = entry._sum.durationMinutes || 0;
        const hourlyCost = Number(user.hourlyCost);
        workers.push({
          id: user.id,
          name: user.name,
          type: 'internal',
          minutes,
          hourlyCost,
          totalCost: this.calculateCost(minutes, hourlyCost),
        });
      }
    });

    // Add external workers (only for full admins)
    externalEntries.forEach((entry) => {
      const externalWorker = externalWorkersMap.get(entry.externalWorkerId);
      if (externalWorker) {
        const minutes = entry._sum.minutes || 0;
        const hourlyCost = Number(externalWorker.hourlyCost);
        workers.push({
          id: externalWorker.id,
          name: externalWorker.name,
          type: 'external',
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
   * Returns aggregated data for all active workers (users + externals)
   */
  async getWorkersSummary(
    companyId: string,
    options?: { userIds?: string[] | null },
  ): Promise<WorkersSummaryResponse> {
    // Get all active internal users with their time entries aggregated
    const activeUsers = await this.prisma.user.findMany({
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
    });

    // Get time entries grouped by user
    const userTimeEntries = await this.prisma.timeEntry.groupBy({
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
    });

    const userMinutesMap = new Map<string, number>();
    userTimeEntries.forEach((entry) => {
      userMinutesMap.set(entry.userId, entry._sum.durationMinutes || 0);
    });

    // Get all active external workers with their hours aggregated
    // Only include external workers if no team scope filter (full admins)
    const activeExternalWorkers = options?.userIds
      ? []
      : await this.prisma.externalWorker.findMany({
          where: {
            companyId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            hourlyCost: true,
          },
        });

    // Get external hours grouped by external worker (only if no team scope)
    const externalHoursEntries = options?.userIds
      ? []
      : await this.prisma.externalHours.groupBy({
          by: ['externalWorkerId'],
          where: {
            companyId,
            externalWorker: {
              isActive: true,
            },
          },
          _sum: {
            minutes: true,
          },
        });

    const externalMinutesMap = new Map<string, number>();
    externalHoursEntries.forEach((entry) => {
      externalMinutesMap.set(entry.externalWorkerId, entry._sum.minutes || 0);
    });

    // Build workers array
    const workers: WorkerSummaryItem[] = [];

    // Add internal users
    activeUsers.forEach((user) => {
      const totalMinutes = userMinutesMap.get(user.id) || 0;
      const hourlyCost = Number(user.hourlyCost);
      workers.push({
        id: user.id,
        name: user.name,
        type: 'internal',
        hourlyCost,
        totalMinutes,
        totalCost: this.calculateCost(totalMinutes, hourlyCost),
      });
    });

    // Add external workers
    activeExternalWorkers.forEach((externalWorker) => {
      const totalMinutes = externalMinutesMap.get(externalWorker.id) || 0;
      const hourlyCost = Number(externalWorker.hourlyCost);
      workers.push({
        id: externalWorker.id,
        name: externalWorker.name,
        type: 'external',
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
    workerId: string,
    workerType: 'internal' | 'external',
    companyId: string,
  ): Promise<WorkerBreakdownResponse> {
    if (workerType === 'internal') {
      return this.getInternalWorkerBreakdown(workerId, companyId);
    } else {
      return this.getExternalWorkerBreakdown(workerId, companyId);
    }
  }

  private async getInternalWorkerBreakdown(
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
      workerType: 'internal',
      worker: {
        id: user.id,
        name: user.name,
        hourlyCost,
      },
      projects: projectsBreakdown,
    };
  }

  private async getExternalWorkerBreakdown(
    externalWorkerId: string,
    companyId: string,
  ): Promise<WorkerBreakdownResponse> {
    // Verify external worker exists and belongs to company
    const externalWorker = await this.prisma.externalWorker.findFirst({
      where: {
        id: externalWorkerId,
        companyId,
      },
      select: {
        id: true,
        name: true,
        hourlyCost: true,
      },
    });

    if (!externalWorker) {
      throw new NotFoundException(
        `Externo con ID ${externalWorkerId} no encontrado`,
      );
    }

    // Get external hours grouped by project
    const externalHours = await this.prisma.externalHours.groupBy({
      by: ['projectId'],
      where: {
        externalWorkerId,
        companyId,
      },
      _sum: {
        minutes: true,
      },
    });

    // Get project details
    const projectIds = externalHours.map((e) => e.projectId);
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
    const hourlyCost = Number(externalWorker.hourlyCost);

    // Build projects array
    const projectsBreakdown = externalHours
      .map((entry) => {
        const project = projectsMap.get(entry.projectId);
        if (!project) return null;

        const minutes = entry._sum.minutes || 0;
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
      workerType: 'external',
      worker: {
        id: externalWorker.id,
        name: externalWorker.name,
        hourlyCost,
      },
      projects: projectsBreakdown,
    };
  }

  /**
   * GET /analytics/payroll-summary
   * Returns payroll summary for all users in the given date range
   * Includes expected vs logged hours, absence breakdowns, and cost calculations
   */
  async getPayrollSummary(
    companyId: string,
    startDate: string,
    endDate: string,
    options?: { userIds?: string[] | null },
  ): Promise<PayrollSummaryResponse> {
    const fromDate = new Date(startDate);
    const toDate = new Date(endDate);

    // Get company location for holidays
    const location = await this.prisma.companyLocation.findUnique({
      where: { companyId },
    });

    // Get all active users (filtered by team scope if applicable)
    const users = await this.prisma.user.findMany({
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
    });

    // Fetch holidays once (shared across all users)
    const [publicHolidays, companyHolidays] = await Promise.all([
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
    ]);

    // Process each user in parallel
    const userSummaries = await Promise.all(
      users.map((user) =>
        this.calculateUserPayrollSummary(
          user,
          companyId,
          fromDate,
          toDate,
          publicHolidays,
          companyHolidays,
        ),
      ),
    );

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
   * Calculate payroll summary for a single user
   */
  private async calculateUserPayrollSummary(
    user: {
      id: string;
      name: string;
      email: string;
      hourlyCost: { toNumber(): number } | number;
      createdAt: Date;
      team: { id: string; name: string } | null;
    },
    companyId: string,
    fromDate: Date,
    toDate: Date,
    publicHolidays: PublicHoliday[],
    companyHolidays: CompanyHoliday[],
  ): Promise<PayrollUserSummary> {
    // Fetch user-specific data in parallel
    const [schedules, absences, timeEntries] = await Promise.all([
      this.workSchedulesService.getWorkSchedules(companyId, user.id),
      this.absencesService.getAbsencesInRange(
        companyId,
        user.id,
        fromDate,
        toDate,
      ),
      this.timeEntriesService.getTimeEntriesInRange(
        companyId,
        user.id,
        fromDate,
        toDate,
      ),
    ]);

    // Build lookup maps
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

    const scheduleMap = new Map<number, WorkSchedule>();
    schedules.forEach((s) => scheduleMap.set(s.dayOfWeek, s));

    // Group time entries by date
    const entriesByDate = new Map<string, TimeEntry[]>();
    timeEntries.forEach((e) => {
      const dateKey = e.startTime.toISOString().split('T')[0];
      const existing = entriesByDate.get(dateKey) || [];
      existing.push(e);
      entriesByDate.set(dateKey, existing);
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
      const dateKey = currentDate.toISOString().split('T')[0];
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
      const absence = absences.find(
        (a) => currentDate >= a.startDate && currentDate <= a.endDate,
      );

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
        } else if (absence.type === 'SICK_LEAVE') {
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
