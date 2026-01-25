import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TeamScopeService } from '../auth/team-scope.service.js';
import type { UpsertMonthlyRevenueDto } from './dto/upsert-monthly-revenue.dto.js';
import type { CreateCostEstimateDto } from './dto/create-cost-estimate.dto.js';
import type { UpdateCostEstimateDto } from './dto/update-cost-estimate.dto.js';
import type { CreateCostActualDto } from './dto/create-cost-actual.dto.js';
import type { UpdateCostActualDto } from './dto/update-cost-actual.dto.js';
import type { SaveAnnualCostsDto } from './dto/save-annual-costs.dto.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import type {
  ProjectMonthlyRevenue,
  ProjectExternalCostEstimate,
  ProjectExternalCostActual,
  ExternalCostExpenseType,
} from '@prisma/client';

// Response interfaces
export interface MonthlyRevenueResponse {
  id: string;
  projectId: string;
  year: number;
  month: number;
  estimatedRevenue: number | null;
  actualRevenue: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface ProviderInfo {
  id: string;
  name: string;
  paymentPeriod: number; // Payment period in days
}

export interface CostEstimateResponse {
  id: string;
  projectId: string;
  year: number;
  month: number;
  amount: number;
  provider: ProviderInfo | null;
  expenseType: ExternalCostExpenseType | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CostActualResponse {
  id: string;
  projectId: string;
  year: number;
  month: number;
  amount: number;
  provider: ProviderInfo;
  expenseType: ExternalCostExpenseType;
  description: string | null;
  isBilled: boolean;
  issueDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface FullMonthlyCostsResponse {
  projectId: string;
  year: number;
  month: number;
  revenue: {
    estimated: number | null;
    actual: number | null;
    notes: string | null;
  };
  externalCosts: {
    estimated: {
      total: number;
      items: CostEstimateResponse[];
    };
    actual: {
      total: number;
      items: CostActualResponse[];
    };
  };
  internalCosts: number | null; // null for team leaders (only visible to admin/owner)
  netResult: {
    estimated: number | null;
    actual: number | null;
  };
}

// Response interfaces for bulk endpoint
export interface MonthCosts {
  month: number;
  revenue: {
    estimated: number | null;
    actual: number | null;
  };
  externalCosts: {
    estimated: number;
    actual: number;
  };
  internalCosts: number | null; // null for team leaders (only visible to admin/owner)
  netResult: {
    estimated: number | null;
    actual: number | null;
  };
}

export interface ProjectCostsSummary {
  projectId: string;
  projectName: string;
  teamId: string | null;
  teamName: string | null;
  year: number;
  months: MonthCosts[];
}

export interface AllProjectsCostsResponse {
  projects: ProjectCostsSummary[];
}

// Response interfaces for annual costs endpoint
export interface AnnualMonthCosts {
  month: number;
  revenueId: string | null;
  estimatedRevenue: number | null;
  actualRevenue: number | null;
  estimatedCosts: CostEstimateResponse[];
  estimatedCostsTotal: number;
  actualCosts: CostActualResponse[];
  actualCostsTotal: number;
}

export interface AnnualProjectCosts {
  projectId: string;
  projectName: string;
  projectCode: string;
  teamId: string | null;
  teamName: string | null;
  months: AnnualMonthCosts[];
}

export interface AnnualCostsResponse {
  year: number;
  projects: AnnualProjectCosts[];
}

@Injectable()
export class CostsService {
  private readonly logger = new Logger(CostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamScopeService: TeamScopeService,
  ) {}

  /**
   * Verify project exists and user has access.
   * Uses TeamScopeService for consistent authorization across the codebase.
   */
  private async verifyProjectAccess(
    projectId: string,
    companyId: string,
    user: JwtPayload,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
    }

    // Full admins (OWNER/ADMIN) can access all projects
    if (this.teamScopeService.isFullAdmin(user)) {
      return;
    }

    // Team leaders can only access their team's projects
    if (!project.teamId || project.teamId !== user.teamId) {
      throw new ForbiddenException(
        'Solo puedes acceder a proyectos de tu equipo',
      );
    }
  }

  // ==================== MONTHLY REVENUE ====================

  async getMonthlyRevenues(
    projectId: string,
    companyId: string,
    user: JwtPayload,
    year?: number,
  ): Promise<MonthlyRevenueResponse[]> {
    await this.verifyProjectAccess(projectId, companyId, user);

    const revenues = await this.prisma.projectMonthlyRevenue.findMany({
      where: {
        projectId,
        ...(year && { year }),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return revenues.map((r) => this.toMonthlyRevenueResponse(r));
  }

  async upsertMonthlyRevenue(
    projectId: string,
    year: number,
    month: number,
    companyId: string,
    user: JwtPayload,
    dto: UpsertMonthlyRevenueDto,
  ): Promise<MonthlyRevenueResponse> {
    await this.verifyProjectAccess(projectId, companyId, user);

    const revenue = await this.prisma.projectMonthlyRevenue.upsert({
      where: {
        projectId_year_month: { projectId, year, month },
      },
      update: {
        estimatedRevenue: dto.estimatedRevenue,
        actualRevenue: dto.actualRevenue,
        notes: dto.notes,
      },
      create: {
        projectId,
        year,
        month,
        estimatedRevenue: dto.estimatedRevenue,
        actualRevenue: dto.actualRevenue,
        notes: dto.notes,
      },
    });

    return this.toMonthlyRevenueResponse(revenue);
  }

  // ==================== COST ESTIMATES ====================

  async getCostEstimates(
    projectId: string,
    companyId: string,
    user: JwtPayload,
    year?: number,
    month?: number,
  ): Promise<CostEstimateResponse[]> {
    await this.verifyProjectAccess(projectId, companyId, user);

    const estimates = await this.prisma.projectExternalCostEstimate.findMany({
      where: {
        projectId,
        ...(year && { year }),
        ...(month && { month }),
      },
      include: {
        provider: true,
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });

    return estimates.map((e) => this.toCostEstimateResponse(e));
  }

  async createCostEstimate(
    projectId: string,
    companyId: string,
    user: JwtPayload,
    dto: CreateCostEstimateDto,
  ): Promise<CostEstimateResponse> {
    await this.verifyProjectAccess(projectId, companyId, user);

    const estimate = await this.prisma.projectExternalCostEstimate.create({
      data: {
        projectId,
        year: dto.year,
        month: dto.month,
        amount: dto.amount,
        providerId: dto.providerId,
        expenseType: dto.expenseType,
        description: dto.description,
      },
      include: {
        provider: true,
      },
    });

    return this.toCostEstimateResponse(estimate);
  }

  async updateCostEstimate(
    id: string,
    companyId: string,
    user: JwtPayload,
    dto: UpdateCostEstimateDto,
  ): Promise<CostEstimateResponse> {
    const existing = await this.prisma.projectExternalCostEstimate.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing || existing.project.companyId !== companyId) {
      throw new NotFoundException(
        `Estimación de coste con ID ${id} no encontrada`,
      );
    }

    await this.verifyProjectAccess(existing.projectId, companyId, user);

    const estimate = await this.prisma.projectExternalCostEstimate.update({
      where: { id },
      data: {
        year: dto.year,
        month: dto.month,
        amount: dto.amount,
        providerId: dto.providerId,
        expenseType: dto.expenseType,
        description: dto.description,
      },
      include: {
        provider: true,
      },
    });

    return this.toCostEstimateResponse(estimate);
  }

  async deleteCostEstimate(
    id: string,
    companyId: string,
    user: JwtPayload,
  ): Promise<void> {
    const existing = await this.prisma.projectExternalCostEstimate.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing || existing.project.companyId !== companyId) {
      throw new NotFoundException(
        `Estimación de coste con ID ${id} no encontrada`,
      );
    }

    await this.verifyProjectAccess(existing.projectId, companyId, user);

    await this.prisma.projectExternalCostEstimate.delete({
      where: { id },
    });
  }

  // ==================== COST ACTUALS ====================

  async getCostActuals(
    projectId: string,
    companyId: string,
    user: JwtPayload,
    year?: number,
    month?: number,
  ): Promise<CostActualResponse[]> {
    await this.verifyProjectAccess(projectId, companyId, user);

    const actuals = await this.prisma.projectExternalCostActual.findMany({
      where: {
        projectId,
        ...(year && { year }),
        ...(month && { month }),
      },
      include: {
        provider: true,
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });

    return actuals.map((a) => this.toCostActualResponse(a));
  }

  async createCostActual(
    projectId: string,
    companyId: string,
    user: JwtPayload,
    dto: CreateCostActualDto,
  ): Promise<CostActualResponse> {
    await this.verifyProjectAccess(projectId, companyId, user);

    const actual = await this.prisma.projectExternalCostActual.create({
      data: {
        projectId,
        year: dto.year,
        month: dto.month,
        amount: dto.amount,
        providerId: dto.providerId,
        expenseType: dto.expenseType,
        description: dto.description,
        isBilled: dto.isBilled ?? false,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
      },
      include: {
        provider: true,
      },
    });

    return this.toCostActualResponse(actual);
  }

  async updateCostActual(
    id: string,
    companyId: string,
    user: JwtPayload,
    dto: UpdateCostActualDto,
  ): Promise<CostActualResponse> {
    const existing = await this.prisma.projectExternalCostActual.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing || existing.project.companyId !== companyId) {
      throw new NotFoundException(`Coste real con ID ${id} no encontrado`);
    }

    await this.verifyProjectAccess(existing.projectId, companyId, user);

    const actual = await this.prisma.projectExternalCostActual.update({
      where: { id },
      data: {
        year: dto.year,
        month: dto.month,
        amount: dto.amount,
        providerId: dto.providerId,
        expenseType: dto.expenseType,
        description: dto.description,
        isBilled: dto.isBilled,
        issueDate:
          dto.issueDate !== undefined
            ? dto.issueDate
              ? new Date(dto.issueDate)
              : null
            : undefined,
      },
      include: {
        provider: true,
      },
    });

    return this.toCostActualResponse(actual);
  }

  async deleteCostActual(
    id: string,
    companyId: string,
    user: JwtPayload,
  ): Promise<void> {
    const existing = await this.prisma.projectExternalCostActual.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing || existing.project.companyId !== companyId) {
      throw new NotFoundException(`Coste real con ID ${id} no encontrado`);
    }

    await this.verifyProjectAccess(existing.projectId, companyId, user);

    await this.prisma.projectExternalCostActual.delete({
      where: { id },
    });
  }

  // ==================== FULL MONTHLY VIEW ====================

  async getFullMonthlyCosts(
    projectId: string,
    year: number,
    month: number,
    companyId: string,
    user: JwtPayload,
  ): Promise<FullMonthlyCostsResponse> {
    await this.verifyProjectAccess(projectId, companyId, user);

    const isFullAdmin = this.teamScopeService.isFullAdmin(user);

    // Fetch all data in parallel
    const [revenue, costEstimates, costActuals, internalCostsRaw] =
      await Promise.all([
        this.prisma.projectMonthlyRevenue.findUnique({
          where: { projectId_year_month: { projectId, year, month } },
        }),
        this.prisma.projectExternalCostEstimate.findMany({
          where: { projectId, year, month },
          include: { provider: true },
        }),
        this.prisma.projectExternalCostActual.findMany({
          where: { projectId, year, month },
          include: { provider: true },
        }),
        this.calculateInternalCosts(projectId, companyId, year, month),
      ]);

    // Hide internal costs for team leaders (only show to admin/owner)
    const internalCosts = isFullAdmin ? internalCostsRaw : null;

    // Calculate totals
    const estimatedCostsTotal = costEstimates.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );
    const actualCostsTotal = costActuals.reduce(
      (sum, a) => sum + Number(a.amount),
      0,
    );

    const estimatedRevenue = revenue?.estimatedRevenue
      ? Number(revenue.estimatedRevenue)
      : null;
    const actualRevenue = revenue?.actualRevenue
      ? Number(revenue.actualRevenue)
      : null;

    // For netResult, only include internal costs if visible (admin/owner)
    const internalCostsForCalc = internalCosts ?? 0;

    return {
      projectId,
      year,
      month,
      revenue: {
        estimated: estimatedRevenue,
        actual: actualRevenue,
        notes: revenue?.notes ?? null,
      },
      externalCosts: {
        estimated: {
          total: estimatedCostsTotal,
          items: costEstimates.map((e) => this.toCostEstimateResponse(e)),
        },
        actual: {
          total: actualCostsTotal,
          items: costActuals.map((a) => this.toCostActualResponse(a)),
        },
      },
      internalCosts,
      netResult: {
        estimated:
          estimatedRevenue !== null
            ? estimatedRevenue - estimatedCostsTotal - internalCostsForCalc
            : null,
        actual:
          actualRevenue !== null
            ? actualRevenue - actualCostsTotal - internalCostsForCalc
            : null,
      },
    };
  }

  /**
   * Calculate internal costs from time entries for a project/month
   * Internal cost = sum of (hours * user.hourlyCost)
   */
  private async calculateInternalCosts(
    projectId: string,
    companyId: string,
    year: number,
    month: number,
  ): Promise<number> {
    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get all time entries for this project in the month (WORK and PAUSE_COFFEE count as worked time)
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        projectId,
        companyId,
        entryType: { in: ['WORK', 'PAUSE_COFFEE'] },
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: {
          select: { hourlyCost: true },
        },
      },
    });

    // Calculate total cost
    let totalCost = 0;
    for (const entry of timeEntries) {
      const hours = entry.durationMinutes / 60;
      const hourlyCost = Number(entry.user.hourlyCost);
      totalCost += hours * hourlyCost;
    }

    return Math.round(totalCost * 100) / 100;
  }

  // ==================== BULK ENDPOINT ====================

  /**
   * Get costs data for all projects the user has access to.
   * - Admin/Owner: All company projects
   * - Team Leader: Only their team's projects (internalCosts hidden)
   */
  async getAllProjectsCosts(
    companyId: string,
    user: JwtPayload,
    year: number,
    month?: number,
  ): Promise<AllProjectsCostsResponse> {
    // Get accessible projects based on user role
    const isFullAdmin = this.teamScopeService.isFullAdmin(user);
    const teamId = isFullAdmin ? null : user.teamId;

    const projects = await this.prisma.project.findMany({
      where: {
        companyId,
        isActive: true,
        ...(teamId && { teamId }),
      },
      select: {
        id: true,
        name: true,
        teamId: true,
        team: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Determine which months to fetch
    const monthsToFetch = month
      ? [month]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    // Fetch costs data for all projects in parallel
    const projectSummaries = await Promise.all(
      projects.map(async (project) => {
        const months = await this.getProjectMonthsCosts(
          project.id,
          companyId,
          year,
          monthsToFetch,
          isFullAdmin,
        );

        return {
          projectId: project.id,
          projectName: project.name,
          teamId: project.teamId,
          teamName: project.team?.name ?? null,
          year,
          months,
        };
      }),
    );

    return { projects: projectSummaries };
  }

  /**
   * Get costs data for specific months of a project.
   * Internal costs are hidden (set to 0) for team leaders.
   */
  private async getProjectMonthsCosts(
    projectId: string,
    companyId: string,
    year: number,
    months: number[],
    isFullAdmin: boolean = true,
  ): Promise<MonthCosts[]> {
    // Fetch all revenues for the year
    const revenues = await this.prisma.projectMonthlyRevenue.findMany({
      where: { projectId, year },
    });
    const revenueByMonth = new Map(revenues.map((r) => [r.month, r]));

    // Fetch all cost estimates for the year
    const costEstimates =
      await this.prisma.projectExternalCostEstimate.findMany({
        where: { projectId, year },
      });

    // Fetch all cost actuals for the year
    const costActuals = await this.prisma.projectExternalCostActual.findMany({
      where: { projectId, year },
    });

    // Group costs by month
    const estimatesByMonth = new Map<number, number>();
    for (const estimate of costEstimates) {
      const current = estimatesByMonth.get(estimate.month) ?? 0;
      estimatesByMonth.set(estimate.month, current + Number(estimate.amount));
    }

    const actualsByMonth = new Map<number, number>();
    for (const actual of costActuals) {
      const current = actualsByMonth.get(actual.month) ?? 0;
      actualsByMonth.set(actual.month, current + Number(actual.amount));
    }

    // Calculate internal costs for each month in parallel
    const internalCostsPromises = months.map((month) =>
      this.calculateInternalCosts(projectId, companyId, year, month),
    );
    const internalCostsResults = await Promise.all(internalCostsPromises);
    const internalCostsByMonth = new Map(
      months.map((month, index) => [month, internalCostsResults[index]]),
    );

    // Build response for each month
    return months.map((month) => {
      const revenue = revenueByMonth.get(month);
      const estimatedRevenue = revenue?.estimatedRevenue
        ? Number(revenue.estimatedRevenue)
        : null;
      const actualRevenue = revenue?.actualRevenue
        ? Number(revenue.actualRevenue)
        : null;

      const estimatedCosts = estimatesByMonth.get(month) ?? 0;
      const actualCosts = actualsByMonth.get(month) ?? 0;
      // Hide internal costs for team leaders (only show to admin/owner)
      const internalCostsRaw = internalCostsByMonth.get(month) ?? 0;
      const internalCosts = isFullAdmin ? internalCostsRaw : null;
      // For netResult, only include internal costs if visible (admin/owner)
      const internalCostsForCalc = internalCosts ?? 0;

      return {
        month,
        revenue: {
          estimated: estimatedRevenue,
          actual: actualRevenue,
        },
        externalCosts: {
          estimated: estimatedCosts,
          actual: actualCosts,
        },
        internalCosts,
        netResult: {
          estimated:
            estimatedRevenue !== null
              ? estimatedRevenue - estimatedCosts - internalCostsForCalc
              : null,
          actual:
            actualRevenue !== null
              ? actualRevenue - actualCosts - internalCostsForCalc
              : null,
        },
      };
    });
  }

  // ==================== ANNUAL COSTS ====================

  /**
   * Get annual costs data for all projects the user has access to.
   * Returns full cost arrays for each month (12 months total).
   * Uses efficient batch queries to avoid N+1 problems.
   */
  async getAnnualProjectsCosts(
    companyId: string,
    user: JwtPayload,
    year: number,
  ): Promise<AnnualCostsResponse> {
    // Get accessible projects based on user role
    const teamId = this.teamScopeService.isFullAdmin(user) ? null : user.teamId;

    const projects = await this.prisma.project.findMany({
      where: {
        companyId,
        isActive: true,
        ...(teamId && { teamId }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        teamId: true,
        team: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (projects.length === 0) {
      return { year, projects: [] };
    }

    const projectIds = projects.map((p) => p.id);

    // Batch fetch all data for the year in 3 parallel queries
    const [revenues, estimates, actuals] = await Promise.all([
      this.prisma.projectMonthlyRevenue.findMany({
        where: { projectId: { in: projectIds }, year },
      }),
      this.prisma.projectExternalCostEstimate.findMany({
        where: { projectId: { in: projectIds }, year },
        include: { provider: true },
      }),
      this.prisma.projectExternalCostActual.findMany({
        where: { projectId: { in: projectIds }, year },
        include: { provider: true },
      }),
    ]);

    // Group data by projectId + month
    const revenueMap = new Map<string, ProjectMonthlyRevenue>();
    for (const r of revenues) {
      revenueMap.set(`${r.projectId}-${r.month}`, r);
    }

    type EstimateWithProvider = (typeof estimates)[number];
    const estimatesMap = new Map<string, EstimateWithProvider[]>();
    for (const e of estimates) {
      const key = `${e.projectId}-${e.month}`;
      const list = estimatesMap.get(key) ?? [];
      list.push(e);
      estimatesMap.set(key, list);
    }

    type ActualWithProvider = (typeof actuals)[number];
    const actualsMap = new Map<string, ActualWithProvider[]>();
    for (const a of actuals) {
      const key = `${a.projectId}-${a.month}`;
      const list = actualsMap.get(key) ?? [];
      list.push(a);
      actualsMap.set(key, list);
    }

    // Build response for all projects
    const projectCosts: AnnualProjectCosts[] = projects.map((project) => {
      const months: AnnualMonthCosts[] = [];

      for (let month = 1; month <= 12; month++) {
        const key = `${project.id}-${month}`;
        const revenue = revenueMap.get(key);
        const monthEstimates = estimatesMap.get(key) ?? [];
        const monthActuals = actualsMap.get(key) ?? [];

        const estimatedCostsTotal = monthEstimates.reduce(
          (sum, e) => sum + Number(e.amount),
          0,
        );
        const actualCostsTotal = monthActuals.reduce(
          (sum, a) => sum + Number(a.amount),
          0,
        );

        months.push({
          month,
          revenueId: revenue?.id ?? null,
          estimatedRevenue: revenue?.estimatedRevenue
            ? Number(revenue.estimatedRevenue)
            : null,
          actualRevenue: revenue?.actualRevenue
            ? Number(revenue.actualRevenue)
            : null,
          estimatedCosts: monthEstimates.map((e) =>
            this.toCostEstimateResponse(e),
          ),
          estimatedCostsTotal,
          actualCosts: monthActuals.map((a) => this.toCostActualResponse(a)),
          actualCostsTotal,
        });
      }

      return {
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
        teamId: project.teamId,
        teamName: project.team?.name ?? null,
        months,
      };
    });

    return { year, projects: projectCosts };
  }

  /**
   * Bulk save annual costs data.
   * Handles revenue upserts and cost estimate create/update operations.
   * Uses a transaction for atomicity.
   */
  async saveAnnualCosts(
    companyId: string,
    user: JwtPayload,
    dto: SaveAnnualCostsDto,
  ): Promise<void> {
    // Collect all unique projectIds from the request
    const projectIds = [...new Set(dto.items.map((item) => item.projectId))];

    // Validate all projects exist and user has access
    const teamId = this.teamScopeService.isFullAdmin(user) ? null : user.teamId;

    const accessibleProjects = await this.prisma.project.findMany({
      where: {
        id: { in: projectIds },
        companyId,
        ...(teamId && { teamId }),
      },
      select: { id: true },
    });

    const accessibleProjectIds = new Set(accessibleProjects.map((p) => p.id));

    // Check if any project is not accessible
    for (const projectId of projectIds) {
      if (!accessibleProjectIds.has(projectId)) {
        throw new ForbiddenException(
          `No tienes acceso al proyecto ${projectId}`,
        );
      }
    }

    // Process all items in a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        // Handle revenue upsert if provided
        if (item.revenue) {
          await tx.projectMonthlyRevenue.upsert({
            where: {
              projectId_year_month: {
                projectId: item.projectId,
                year: dto.year,
                month: item.month,
              },
            },
            update: {
              ...(item.revenue.estimatedRevenue !== undefined && {
                estimatedRevenue: item.revenue.estimatedRevenue,
              }),
              ...(item.revenue.actualRevenue !== undefined && {
                actualRevenue: item.revenue.actualRevenue,
              }),
              ...(item.revenue.notes !== undefined && {
                notes: item.revenue.notes,
              }),
            },
            create: {
              projectId: item.projectId,
              year: dto.year,
              month: item.month,
              estimatedRevenue: item.revenue.estimatedRevenue ?? null,
              actualRevenue: item.revenue.actualRevenue ?? null,
              notes: item.revenue.notes ?? null,
            },
          });
        }

        // Handle cost estimate operation if provided
        if (item.costEstimate) {
          if (item.costEstimate.action === 'create') {
            await tx.projectExternalCostEstimate.create({
              data: {
                projectId: item.projectId,
                year: dto.year,
                month: item.month,
                amount: item.costEstimate.amount,
                providerId: item.costEstimate.providerId,
                expenseType: item.costEstimate.expenseType,
                description: item.costEstimate.description,
              },
            });
          } else {
            // action === 'update'
            // Verify the cost estimate exists and belongs to an accessible project
            const existing = await tx.projectExternalCostEstimate.findUnique({
              where: { id: item.costEstimate.id },
              include: { project: true },
            });

            if (!existing || existing.project.companyId !== companyId) {
              throw new NotFoundException(
                `Estimación de coste con ID ${item.costEstimate.id} no encontrada`,
              );
            }

            if (!accessibleProjectIds.has(existing.projectId)) {
              throw new ForbiddenException(
                `No tienes acceso a la estimación de coste ${item.costEstimate.id}`,
              );
            }

            await tx.projectExternalCostEstimate.update({
              where: { id: item.costEstimate.id },
              data: {
                amount: item.costEstimate.amount,
                ...(item.costEstimate.providerId !== undefined && {
                  providerId: item.costEstimate.providerId,
                }),
                ...(item.costEstimate.expenseType !== undefined && {
                  expenseType: item.costEstimate.expenseType,
                }),
                ...(item.costEstimate.description !== undefined && {
                  description: item.costEstimate.description,
                }),
              },
            });
          }
        }
      }
    });
  }

  // ==================== RESPONSE MAPPERS ====================

  private toMonthlyRevenueResponse(
    revenue: ProjectMonthlyRevenue,
  ): MonthlyRevenueResponse {
    return {
      id: revenue.id,
      projectId: revenue.projectId,
      year: revenue.year,
      month: revenue.month,
      estimatedRevenue: revenue.estimatedRevenue
        ? Number(revenue.estimatedRevenue)
        : null,
      actualRevenue: revenue.actualRevenue
        ? Number(revenue.actualRevenue)
        : null,
      notes: revenue.notes,
      createdAt: revenue.createdAt,
      updatedAt: revenue.updatedAt,
    };
  }

  private toCostEstimateResponse(
    estimate: ProjectExternalCostEstimate & {
      provider: { id: string; name: string; paymentPeriod: number } | null;
    },
  ): CostEstimateResponse {
    return {
      id: estimate.id,
      projectId: estimate.projectId,
      year: estimate.year,
      month: estimate.month,
      amount: Number(estimate.amount),
      provider: estimate.provider
        ? {
            id: estimate.provider.id,
            name: estimate.provider.name,
            paymentPeriod: estimate.provider.paymentPeriod,
          }
        : null,
      expenseType: estimate.expenseType,
      description: estimate.description,
      createdAt: estimate.createdAt,
      updatedAt: estimate.updatedAt,
    };
  }

  private toCostActualResponse(
    actual: ProjectExternalCostActual & {
      provider: { id: string; name: string; paymentPeriod: number };
    },
  ): CostActualResponse {
    return {
      id: actual.id,
      projectId: actual.projectId,
      year: actual.year,
      month: actual.month,
      amount: Number(actual.amount),
      provider: {
        id: actual.provider.id,
        name: actual.provider.name,
        paymentPeriod: actual.provider.paymentPeriod,
      },
      expenseType: actual.expenseType,
      description: actual.description,
      isBilled: actual.isBilled,
      issueDate: actual.issueDate,
      createdAt: actual.createdAt,
      updatedAt: actual.updatedAt,
    };
  }
}
