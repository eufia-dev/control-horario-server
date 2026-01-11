import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
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

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
