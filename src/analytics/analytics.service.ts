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
   */
  async getProjectsSummary(
    organizationId: string,
  ): Promise<ProjectsSummaryResponse> {
    // Get all active projects for the organization
    const projects = await this.prisma.project.findMany({
      where: {
        is_active: true,
        company: {
          organization_id: organizationId,
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    // Get internal time entries aggregated by project
    const internalTimeEntries = await this.prisma.time_entry.groupBy({
      by: ['project_id'],
      where: {
        organization_id: organizationId,
        project: {
          is_active: true,
        },
      },
      _sum: {
        minutes: true,
      },
    });

    // Get external hours aggregated by project
    const externalHours = await this.prisma.external_hours.groupBy({
      by: ['project_id'],
      where: {
        organization_id: organizationId,
        project: {
          is_active: true,
        },
      },
      _sum: {
        minutes: true,
      },
    });

    // Get all time entries with user hourly costs for cost calculation
    const timeEntriesWithCosts = await this.prisma.time_entry.findMany({
      where: {
        organization_id: organizationId,
        project: {
          is_active: true,
        },
      },
      select: {
        project_id: true,
        minutes: true,
        user: {
          select: {
            hourly_cost: true,
          },
        },
      },
    });

    // Get all external hours with external hourly costs
    const externalHoursWithCosts = await this.prisma.external_hours.findMany({
      where: {
        organization_id: organizationId,
        project: {
          is_active: true,
        },
      },
      select: {
        project_id: true,
        minutes: true,
        external: {
          select: {
            hourly_cost: true,
          },
        },
      },
    });

    // Create lookup maps
    const internalMinutesMap = new Map<string, number>();
    internalTimeEntries.forEach((entry) => {
      internalMinutesMap.set(entry.project_id, entry._sum.minutes || 0);
    });

    const externalMinutesMap = new Map<string, number>();
    externalHours.forEach((entry) => {
      externalMinutesMap.set(entry.project_id, entry._sum.minutes || 0);
    });

    // Calculate internal costs per project
    const internalCostMap = new Map<string, number>();
    timeEntriesWithCosts.forEach((entry) => {
      const currentCost = internalCostMap.get(entry.project_id) || 0;
      const entryCost = (entry.minutes / 60) * Number(entry.user.hourly_cost);
      internalCostMap.set(entry.project_id, currentCost + entryCost);
    });

    // Calculate external costs per project
    const externalCostMap = new Map<string, number>();
    externalHoursWithCosts.forEach((entry) => {
      const currentCost = externalCostMap.get(entry.project_id) || 0;
      const entryCost =
        (entry.minutes / 60) * Number(entry.external.hourly_cost);
      externalCostMap.set(entry.project_id, currentCost + entryCost);
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
   */
  async getProjectBreakdown(
    projectId: string,
    organizationId: string,
  ): Promise<ProjectBreakdownResponse> {
    // Verify project exists and belongs to organization
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          organization_id: organizationId,
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
    }

    // Get internal time entries grouped by user
    const internalEntries = await this.prisma.time_entry.groupBy({
      by: ['user_id'],
      where: {
        project_id: projectId,
        organization_id: organizationId,
      },
      _sum: {
        minutes: true,
      },
    });

    // Get user details for internal workers
    const userIds = internalEntries.map((e) => e.user_id);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        name: true,
        hourly_cost: true,
      },
    });

    const usersMap = new Map(users.map((u) => [u.id, u]));

    // Get external hours grouped by external
    const externalEntries = await this.prisma.external_hours.groupBy({
      by: ['external_id'],
      where: {
        project_id: projectId,
        organization_id: organizationId,
      },
      _sum: {
        minutes: true,
      },
    });

    // Get external details
    const externalIds = externalEntries.map((e) => e.external_id);
    const externals = await this.prisma.external.findMany({
      where: {
        id: { in: externalIds },
      },
      select: {
        id: true,
        name: true,
        hourly_cost: true,
      },
    });

    const externalsMap = new Map(externals.map((e) => [e.id, e]));

    // Build workers array
    const workers: WorkerBreakdownItem[] = [];

    // Add internal workers
    internalEntries.forEach((entry) => {
      const user = usersMap.get(entry.user_id);
      if (user) {
        const minutes = entry._sum.minutes || 0;
        const hourlyCost = Number(user.hourly_cost);
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

    // Add external workers
    externalEntries.forEach((entry) => {
      const external = externalsMap.get(entry.external_id);
      if (external) {
        const minutes = entry._sum.minutes || 0;
        const hourlyCost = Number(external.hourly_cost);
        workers.push({
          id: external.id,
          name: external.name,
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
    organizationId: string,
  ): Promise<WorkersSummaryResponse> {
    // Get all active internal users with their time entries aggregated
    const activeUsers = await this.prisma.user.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        hourly_cost: true,
      },
    });

    // Get time entries grouped by user
    const userTimeEntries = await this.prisma.time_entry.groupBy({
      by: ['user_id'],
      where: {
        organization_id: organizationId,
        user: {
          is_active: true,
        },
      },
      _sum: {
        minutes: true,
      },
    });

    const userMinutesMap = new Map<string, number>();
    userTimeEntries.forEach((entry) => {
      userMinutesMap.set(entry.user_id, entry._sum.minutes || 0);
    });

    // Get all active externals with their hours aggregated
    const activeExternals = await this.prisma.external.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        hourly_cost: true,
      },
    });

    // Get external hours grouped by external
    const externalHoursEntries = await this.prisma.external_hours.groupBy({
      by: ['external_id'],
      where: {
        organization_id: organizationId,
        external: {
          is_active: true,
        },
      },
      _sum: {
        minutes: true,
      },
    });

    const externalMinutesMap = new Map<string, number>();
    externalHoursEntries.forEach((entry) => {
      externalMinutesMap.set(entry.external_id, entry._sum.minutes || 0);
    });

    // Build workers array
    const workers: WorkerSummaryItem[] = [];

    // Add internal users
    activeUsers.forEach((user) => {
      const totalMinutes = userMinutesMap.get(user.id) || 0;
      const hourlyCost = Number(user.hourly_cost);
      workers.push({
        id: user.id,
        name: user.name,
        type: 'internal',
        hourlyCost,
        totalMinutes,
        totalCost: this.calculateCost(totalMinutes, hourlyCost),
      });
    });

    // Add externals
    activeExternals.forEach((external) => {
      const totalMinutes = externalMinutesMap.get(external.id) || 0;
      const hourlyCost = Number(external.hourly_cost);
      workers.push({
        id: external.id,
        name: external.name,
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
    organizationId: string,
  ): Promise<WorkerBreakdownResponse> {
    if (workerType === 'internal') {
      return this.getInternalWorkerBreakdown(workerId, organizationId);
    } else {
      return this.getExternalWorkerBreakdown(workerId, organizationId);
    }
  }

  private async getInternalWorkerBreakdown(
    userId: string,
    organizationId: string,
  ): Promise<WorkerBreakdownResponse> {
    // Verify user exists and belongs to organization
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organization_id: organizationId,
      },
      select: {
        id: true,
        name: true,
        hourly_cost: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Get time entries grouped by project
    const timeEntries = await this.prisma.time_entry.groupBy({
      by: ['project_id'],
      where: {
        user_id: userId,
        organization_id: organizationId,
      },
      _sum: {
        minutes: true,
      },
    });

    // Get project details
    const projectIds = timeEntries.map((e) => e.project_id);
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
    const hourlyCost = Number(user.hourly_cost);

    // Build projects array
    const projectsBreakdown = timeEntries
      .map((entry) => {
        const project = projectsMap.get(entry.project_id);
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
    externalId: string,
    organizationId: string,
  ): Promise<WorkerBreakdownResponse> {
    // Verify external exists and belongs to organization
    const external = await this.prisma.external.findFirst({
      where: {
        id: externalId,
        organization_id: organizationId,
      },
      select: {
        id: true,
        name: true,
        hourly_cost: true,
      },
    });

    if (!external) {
      throw new NotFoundException(`Externo con ID ${externalId} no encontrado`);
    }

    // Get external hours grouped by project
    const externalHours = await this.prisma.external_hours.groupBy({
      by: ['project_id'],
      where: {
        external_id: externalId,
        organization_id: organizationId,
      },
      _sum: {
        minutes: true,
      },
    });

    // Get project details
    const projectIds = externalHours.map((e) => e.project_id);
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
    const hourlyCost = Number(external.hourly_cost);

    // Build projects array
    const projectsBreakdown = externalHours
      .map((entry) => {
        const project = projectsMap.get(entry.project_id);
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
        id: external.id,
        name: external.name,
        hourlyCost,
      },
      projects: projectsBreakdown,
    };
  }
}
