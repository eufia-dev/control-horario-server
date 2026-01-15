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

export interface CostEstimateResponse {
  id: string;
  projectId: string;
  year: number;
  month: number;
  amount: number;
  provider: string | null;
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
  provider: string;
  expenseType: ExternalCostExpenseType;
  description: string | null;
  paymentPeriod: string | null;
  isBilled: boolean;
  issueDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface FullMonthlyCashFlowResponse {
  projectId: string;
  year: number;
  month: number;
  revenue: {
    estimated: number | null;
    actual: number | null;
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
  internalCosts: number;
  netResult: {
    estimated: number | null;
    actual: number | null;
  };
}

// Response interfaces for bulk endpoint
export interface MonthCashFlow {
  month: number;
  revenue: {
    estimated: number | null;
    actual: number | null;
  };
  externalCosts: {
    estimated: number;
    actual: number;
  };
  internalCosts: number;
  netResult: {
    estimated: number | null;
    actual: number | null;
  };
}

export interface ProjectCashFlowSummary {
  projectId: string;
  projectName: string;
  teamId: string | null;
  year: number;
  months: MonthCashFlow[];
}

export interface AllProjectsCashFlowResponse {
  projects: ProjectCashFlowSummary[];
}

@Injectable()
export class CashFlowService {
  private readonly logger = new Logger(CashFlowService.name);

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
        provider: dto.provider,
        expenseType: dto.expenseType,
        description: dto.description,
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
        provider: dto.provider,
        expenseType: dto.expenseType,
        description: dto.description,
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
        provider: dto.provider,
        expenseType: dto.expenseType,
        description: dto.description,
        paymentPeriod: dto.paymentPeriod,
        isBilled: dto.isBilled ?? false,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
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
        provider: dto.provider,
        expenseType: dto.expenseType,
        description: dto.description,
        paymentPeriod: dto.paymentPeriod,
        isBilled: dto.isBilled,
        issueDate:
          dto.issueDate !== undefined
            ? dto.issueDate
              ? new Date(dto.issueDate)
              : null
            : undefined,
        dueDate:
          dto.dueDate !== undefined
            ? dto.dueDate
              ? new Date(dto.dueDate)
              : null
            : undefined,
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

  async getFullMonthlyCashFlow(
    projectId: string,
    year: number,
    month: number,
    companyId: string,
    user: JwtPayload,
  ): Promise<FullMonthlyCashFlowResponse> {
    await this.verifyProjectAccess(projectId, companyId, user);

    // Fetch all data in parallel
    const [revenue, costEstimates, costActuals, internalCosts] =
      await Promise.all([
        this.prisma.projectMonthlyRevenue.findUnique({
          where: { projectId_year_month: { projectId, year, month } },
        }),
        this.prisma.projectExternalCostEstimate.findMany({
          where: { projectId, year, month },
        }),
        this.prisma.projectExternalCostActual.findMany({
          where: { projectId, year, month },
        }),
        this.calculateInternalCosts(projectId, companyId, year, month),
      ]);

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

    return {
      projectId,
      year,
      month,
      revenue: {
        estimated: estimatedRevenue,
        actual: actualRevenue,
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
            ? estimatedRevenue - estimatedCostsTotal - internalCosts
            : null,
        actual:
          actualRevenue !== null
            ? actualRevenue - actualCostsTotal - internalCosts
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

    // Get all time entries for this project in the month
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        projectId,
        companyId,
        entryType: 'WORK',
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
   * Get cash flow data for all projects the user has access to.
   * - Admin/Owner: All company projects
   * - Team Leader: Only their team's projects
   */
  async getAllProjectsCashFlow(
    companyId: string,
    user: JwtPayload,
    year: number,
    month?: number,
  ): Promise<AllProjectsCashFlowResponse> {
    // Get accessible projects based on user role
    const teamId = this.teamScopeService.isFullAdmin(user) ? null : user.teamId;

    const projects = await this.prisma.project.findMany({
      where: {
        companyId,
        isActive: true,
        ...(teamId && { teamId }),
      },
      select: { id: true, name: true, teamId: true },
      orderBy: { name: 'asc' },
    });

    // Determine which months to fetch
    const monthsToFetch = month
      ? [month]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    // Fetch cash flow data for all projects in parallel
    const projectSummaries = await Promise.all(
      projects.map(async (project) => {
        const months = await this.getProjectMonthsCashFlow(
          project.id,
          companyId,
          year,
          monthsToFetch,
        );

        return {
          projectId: project.id,
          projectName: project.name,
          teamId: project.teamId,
          year,
          months,
        };
      }),
    );

    return { projects: projectSummaries };
  }

  /**
   * Get cash flow data for specific months of a project.
   */
  private async getProjectMonthsCashFlow(
    projectId: string,
    companyId: string,
    year: number,
    months: number[],
  ): Promise<MonthCashFlow[]> {
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
      const internalCosts = internalCostsByMonth.get(month) ?? 0;

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
              ? estimatedRevenue - estimatedCosts - internalCosts
              : null,
          actual:
            actualRevenue !== null
              ? actualRevenue - actualCosts - internalCosts
              : null,
        },
      };
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
    estimate: ProjectExternalCostEstimate,
  ): CostEstimateResponse {
    return {
      id: estimate.id,
      projectId: estimate.projectId,
      year: estimate.year,
      month: estimate.month,
      amount: Number(estimate.amount),
      provider: estimate.provider,
      expenseType: estimate.expenseType,
      description: estimate.description,
      createdAt: estimate.createdAt,
      updatedAt: estimate.updatedAt,
    };
  }

  private toCostActualResponse(
    actual: ProjectExternalCostActual,
  ): CostActualResponse {
    return {
      id: actual.id,
      projectId: actual.projectId,
      year: actual.year,
      month: actual.month,
      amount: Number(actual.amount),
      provider: actual.provider,
      expenseType: actual.expenseType,
      description: actual.description,
      paymentPeriod: actual.paymentPeriod,
      isBilled: actual.isBilled,
      issueDate: actual.issueDate,
      dueDate: actual.dueDate,
      createdAt: actual.createdAt,
      updatedAt: actual.updatedAt,
    };
  }
}
