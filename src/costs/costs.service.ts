import {
  BadRequestException,
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
import type { UpsertMonthlySalaryDto } from './dto/monthly-salary.dto.js';
import type {
  CreateOverheadCostDto,
  UpdateOverheadCostDto,
} from './dto/monthly-overhead.dto.js';
import { OverheadCostTypeLabels } from './dto/monthly-overhead.dto.js';
import { OverheadCostType } from './dto/monthly-overhead.dto.js';
import { MonthClosingStatus } from './dto/month-closing.dto.js';
import type { ReopenMonthDto } from './dto/month-closing.dto.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import type {
  ProjectMonthlyRevenue,
  ProjectExternalCostEstimate,
  ProjectExternalCostActual,
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
  distributedCosts: number | null; // From month closing distribution (null if month not closed)
  isMonthClosed: boolean;
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
  distributedCosts: number | null; // From month closing distribution (null if month not closed)
  isMonthClosed: boolean;
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
  distributedCosts: number | null; // From month closing distribution (null if month not closed)
  isMonthClosed: boolean;
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

// ==================== MONTHLY SALARY RESPONSE INTERFACES ====================

export interface UserMonthlySalary {
  id: string | null; // MonthlyUserSalary record ID (null if no extras entered yet)
  userId: string;
  userName: string;
  userEmail: string;
  baseSalary: number | null; // From User.salary (null if user has no salary set)
  extras: number; // From MonthlyUserSalary.extras (0 if no record)
  totalSalary: number | null; // baseSalary + extras (null if baseSalary is null)
  notes: string | null;
}

export interface MonthlySalariesResponse {
  year: number;
  month: number;
  monthStatus: MonthClosingStatus;
  users: UserMonthlySalary[];
  totals: {
    baseSalaries: number;
    extras: number;
    total: number;
  };
}

export interface MonthlySalaryResponse {
  id: string;
  userId: string;
  year: number;
  month: number;
  baseSalary: number; // Current User.salary after update
  extras: number;
  totalSalary: number;
  notes: string | null;
  warning?: string; // Present if month is CLOSED
}

// ==================== MONTHLY OVERHEAD RESPONSE INTERFACES ====================

export interface OverheadCostResponse {
  id: string;
  amount: number;
  costType: string; // OverheadCostType enum value
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface MonthlyOverheadResponse {
  year: number;
  month: number;
  monthStatus: MonthClosingStatus;
  costs: OverheadCostResponse[];
  total: number;
  warning?: string;
}

export interface OverheadCostTypeOption {
  value: OverheadCostType;
  label: string;
}

// ==================== MONTH CLOSING RESPONSE INTERFACES ====================

export interface ProjectDistribution {
  projectId: string;
  projectName: string;
  projectCode: string;
  projectRevenue: number;
  revenueSharePercent: number;
  distributedSalaries: number;
  distributedOverhead: number;
  distributedNonProductive: number;
  totalDistributed: number;
}

export interface MonthlyClosingResponse {
  id: string | null; // null if month has never been closed
  year: number;
  month: number;
  status: MonthClosingStatus;

  // Totals (null if never closed)
  totalSalaries: number | null;
  totalOverhead: number | null;
  totalNonProductive: number | null;
  totalRevenue: number | null;

  // Audit info
  closedBy: { id: string; name: string } | null;
  closedAt: Date | null;
  reopenedBy: { id: string; name: string } | null;
  reopenedAt: Date | null;
  reopenReason: string | null;

  // Distributions (only present if status !== 'OPEN')
  distributions: ProjectDistribution[] | null;
}

export interface ValidationError {
  type:
    | 'MISSING_SALARY'
    | 'MISSING_REVENUE'
    | 'NO_ACTIVE_PROJECTS'
    | 'ZERO_REVENUE';
  message: string;
  details?: {
    userId?: string;
    userName?: string;
    projectId?: string;
    projectName?: string;
  };
}

export interface DistributionPreviewResponse {
  year: number;
  month: number;
  canClose: boolean;
  validationErrors: ValidationError[];

  // Preview data
  totalSalaries: number;
  totalOverhead: number;
  totalNonProductive: number;
  totalRevenue: number;

  distributions: ProjectDistribution[];
}

export interface CloseMonthResponse {
  success: boolean;
  closing: MonthlyClosingResponse;
}

// ==================== MONTHLY COST CALCULATION TYPES ====================

/**
 * Data structure for user monthly cost calculation
 */
export interface UserMonthlyCostData {
  costHour: number;
  totalHours: number;
  totalSalary: number;
  hasHours: boolean;
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
    const [
      revenue,
      costEstimates,
      costActuals,
      internalCostsRaw,
      distribution,
    ] = await Promise.all([
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
      this.getProjectDistributedCosts(projectId, companyId, year, month),
    ]);

    // Hide internal costs for team leaders (only show to admin/owner)
    const internalCosts = isFullAdmin ? internalCostsRaw : null;
    const distributedCosts = distribution?.totalDistributed ?? null;
    const isMonthClosed = distribution !== null;

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

    // For netResult, include internal costs + distributed costs
    const internalCostsForCalc = internalCosts ?? 0;
    const distributedCostsForCalc = distributedCosts ?? 0;

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
      distributedCosts,
      isMonthClosed,
      netResult: {
        estimated:
          estimatedRevenue !== null
            ? estimatedRevenue - estimatedCostsTotal - internalCostsForCalc
            : null,
        actual:
          actualRevenue !== null
            ? actualRevenue -
              actualCostsTotal -
              internalCostsForCalc -
              distributedCostsForCalc
            : null,
      },
    };
  }

  /**
   * Get distributed costs for a project from month closing distribution.
   * Returns null if month is not closed.
   */
  private async getProjectDistributedCosts(
    projectId: string,
    companyId: string,
    year: number,
    month: number,
  ): Promise<{ totalDistributed: number } | null> {
    // First check if month is closed
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });

    if (!closing || closing.status === 'OPEN') {
      return null;
    }

    // Get distribution for this project
    const distribution = await this.prisma.projectMonthlyDistribution.findFirst(
      {
        where: { closingId: closing.id, projectId },
        select: { totalDistributed: true },
      },
    );

    if (!distribution) {
      return null;
    }

    return { totalDistributed: Number(distribution.totalDistributed) };
  }

  // ==================== MONTHLY COST CALCULATION HELPERS ====================

  /**
   * Calculate monthly cost/hour for all non-GUEST users in the company.
   * costHour = (baseSalary + extras) / totalHoursWorked
   * Does NOT filter by isActive - includes users who may have logged time before being deactivated.
   */
  private async calculateUsersMonthlyCostHour(
    companyId: string,
    year: number,
    month: number,
  ): Promise<Map<string, UserMonthlyCostData>> {
    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get all non-GUEST users (regardless of isActive - they may have logged time before deactivation)
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        deletedAt: null,
        relation: { not: 'GUEST' },
      },
      select: {
        id: true,
        salary: true,
      },
    });

    // Get monthly salary extras for all users
    const salaryRecords = await this.prisma.monthlyUserSalary.findMany({
      where: { companyId, year, month },
    });
    const salaryByUser = new Map(salaryRecords.map((s) => [s.userId, s]));

    // Get all time entries for the month grouped by user
    const timeEntries = await this.prisma.timeEntry.groupBy({
      by: ['userId'],
      where: {
        companyId,
        entryType: { in: ['WORK', 'PAUSE_COFFEE'] },
        startTime: {
          gte: startDate,
          lte: endDate,
        },
        user: {
          relation: { not: 'GUEST' },
        },
      },
      _sum: {
        durationMinutes: true,
      },
    });
    const hoursByUser = new Map(
      timeEntries.map((e) => [e.userId, (e._sum.durationMinutes || 0) / 60]),
    );

    // Build the result map
    const result = new Map<string, UserMonthlyCostData>();

    for (const user of users) {
      const salaryRecord = salaryByUser.get(user.id);
      const baseSalary = user.salary ? Number(user.salary) : 0;
      const extras = salaryRecord ? Number(salaryRecord.extras) : 0;
      const totalSalary = baseSalary + extras;
      const totalHours = hoursByUser.get(user.id) || 0;

      // Only include users who have a salary
      if (totalSalary > 0) {
        const costHour = totalHours > 0 ? totalSalary / totalHours : 0;
        result.set(user.id, {
          costHour,
          totalHours,
          totalSalary,
          hasHours: totalHours > 0,
        });
      }
    }

    return result;
  }

  /**
   * Get IDs of projects that belong to the "No productivos" category.
   */
  private async getNonProductiveProjectIds(
    companyId: string,
  ): Promise<Set<string>> {
    // Find the "No productivos" category
    const category = await this.prisma.projectCategory.findFirst({
      where: {
        companyId,
        name: 'No productivos',
      },
      select: { id: true },
    });

    if (!category) {
      return new Set();
    }

    // Get all projects in this category
    const projects = await this.prisma.project.findMany({
      where: {
        companyId,
        categoryId: category.id,
      },
      select: { id: true },
    });

    return new Set(projects.map((p) => p.id));
  }

  /**
   * Calculate non-productive costs to distribute.
   * Includes:
   * - Hours on "No productivos" category projects * user's costHour
   * - Full salary of users who logged 0 hours
   */
  private async calculateNonProductiveCosts(
    companyId: string,
    year: number,
    month: number,
    userCostHours: Map<string, UserMonthlyCostData>,
  ): Promise<{
    nonProductiveCost: number;
    zeroHoursUsers: Array<{ userId: string; salary: number }>;
    nonProductiveHoursCost: number;
  }> {
    // Get non-productive project IDs
    const nonProductiveProjectIds =
      await this.getNonProductiveProjectIds(companyId);

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get time entries on non-productive projects grouped by user
    let nonProductiveHoursCost = 0;

    if (nonProductiveProjectIds.size > 0) {
      const nonProductiveEntries = await this.prisma.timeEntry.findMany({
        where: {
          companyId,
          projectId: { in: Array.from(nonProductiveProjectIds) },
          entryType: { in: ['WORK', 'PAUSE_COFFEE'] },
          startTime: {
            gte: startDate,
            lte: endDate,
          },
          user: {
            relation: { not: 'GUEST' },
            deletedAt: null,
          },
        },
        select: {
          userId: true,
          durationMinutes: true,
        },
      });

      // Sum cost for non-productive hours
      for (const entry of nonProductiveEntries) {
        const userCostData = userCostHours.get(entry.userId);
        if (userCostData && userCostData.costHour > 0) {
          const hours = entry.durationMinutes / 60;
          nonProductiveHoursCost += hours * userCostData.costHour;
        }
      }
    }

    // Find users with salary but 0 hours - their entire salary is non-productive
    const zeroHoursUsers: Array<{ userId: string; salary: number }> = [];
    for (const [userId, data] of userCostHours) {
      if (!data.hasHours && data.totalSalary > 0) {
        zeroHoursUsers.push({ userId, salary: data.totalSalary });
      }
    }

    const zeroHoursSalaries = zeroHoursUsers.reduce(
      (sum, u) => sum + u.salary,
      0,
    );
    const nonProductiveCost = nonProductiveHoursCost + zeroHoursSalaries;

    return {
      nonProductiveCost: Math.round(nonProductiveCost * 100) / 100,
      zeroHoursUsers,
      nonProductiveHoursCost: Math.round(nonProductiveHoursCost * 100) / 100,
    };
  }

  /**
   * Calculate internal costs from time entries for a project/month
   * Internal cost = sum of (hours * user's cost/hour)
   * When userCostHours is provided (during month closing), uses calculated monthly cost/hour.
   * Otherwise falls back to User.hourlyCost for real-time estimates.
   */
  private async calculateInternalCosts(
    projectId: string,
    companyId: string,
    year: number,
    month: number,
    userCostHours?: Map<string, UserMonthlyCostData>,
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
      // Use monthly cost/hour if provided, otherwise fall back to User.hourlyCost
      const userCostData = userCostHours?.get(entry.userId);
      const hourlyCost =
        userCostData?.costHour ?? Number(entry.user.hourlyCost);
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

    // Get distributed costs for each month
    const distributedCostsPromises = months.map((month) =>
      this.getProjectDistributedCosts(projectId, companyId, year, month),
    );
    const distributedCostsResults = await Promise.all(distributedCostsPromises);
    const distributedCostsByMonth = new Map(
      months.map((month, index) => [month, distributedCostsResults[index]]),
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

      // Get distributed costs
      const distributedData = distributedCostsByMonth.get(month);
      const distributedCosts = distributedData?.totalDistributed ?? null;
      const isMonthClosed = distributedData !== null;

      // For netResult, include internal costs + distributed costs
      const internalCostsForCalc = internalCosts ?? 0;
      const distributedCostsForCalc = distributedCosts ?? 0;

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
        distributedCosts,
        isMonthClosed,
        netResult: {
          estimated:
            estimatedRevenue !== null
              ? estimatedRevenue - estimatedCosts - internalCostsForCalc
              : null,
          actual:
            actualRevenue !== null
              ? actualRevenue -
                actualCosts -
                internalCostsForCalc -
                distributedCostsForCalc
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

    // Batch fetch all data for the year in parallel queries
    const [revenues, estimates, actuals, closings, distributions] =
      await Promise.all([
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
        // Get month closings for the year
        this.prisma.monthlyClosing.findMany({
          where: { companyId, year },
        }),
        // Get distributions for the year
        this.prisma.projectMonthlyDistribution.findMany({
          where: {
            projectId: { in: projectIds },
            closing: { companyId, year },
          },
          include: { closing: { select: { month: true, status: true } } },
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

    // Group closings by month
    const closingByMonth = new Map(
      closings.map((c) => [c.month, c.status !== 'OPEN']),
    );

    // Group distributions by projectId + month
    const distributionMap = new Map<string, number>();
    for (const d of distributions) {
      if (d.closing.status !== 'OPEN') {
        const key = `${d.projectId}-${d.closing.month}`;
        distributionMap.set(key, Number(d.totalDistributed));
      }
    }

    // Build response for all projects
    const projectCosts: AnnualProjectCosts[] = projects.map((project) => {
      const months: AnnualMonthCosts[] = [];

      for (let month = 1; month <= 12; month++) {
        const key = `${project.id}-${month}`;
        const revenue = revenueMap.get(key);
        const monthEstimates = estimatesMap.get(key) ?? [];
        const monthActuals = actualsMap.get(key) ?? [];
        const isMonthClosed = closingByMonth.get(month) ?? false;
        const distributedCosts = distributionMap.get(key) ?? null;

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
          distributedCosts,
          isMonthClosed,
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

  // ==================== MONTHLY SALARIES ====================

  /**
   * Get all active users with their salary data for a specific month.
   * Returns live baseSalary from User.salary for OPEN months,
   * or snapshotted baseSalary for CLOSED months.
   */
  async getMonthlySalaries(
    companyId: string,
    year: number,
    month: number,
  ): Promise<MonthlySalariesResponse> {
    // Get month closing status
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });
    const monthStatus =
      (closing?.status as MonthClosingStatus) ?? MonthClosingStatus.OPEN;

    // Get all active non-GUEST users in the company
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        isActive: true,
        deletedAt: null,
        relation: { not: 'GUEST' },
      },
      select: {
        id: true,
        name: true,
        email: true,
        salary: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get monthly salary records for this month
    const salaryRecords = await this.prisma.monthlyUserSalary.findMany({
      where: { companyId, year, month },
    });
    const salaryByUser = new Map(salaryRecords.map((s) => [s.userId, s]));

    // Build response
    let totalBaseSalaries = 0;
    let totalExtras = 0;

    const userSalaries: UserMonthlySalary[] = users.map((user) => {
      const record = salaryByUser.get(user.id);

      // For CLOSED months, use snapshot; otherwise use live User.salary
      let baseSalary: number | null;
      if (
        monthStatus === MonthClosingStatus.CLOSED &&
        record?.baseSalarySnapshot
      ) {
        baseSalary = Number(record.baseSalarySnapshot);
      } else {
        baseSalary = user.salary ? Number(user.salary) : null;
      }

      const extras = record ? Number(record.extras) : 0;
      const totalSalary = baseSalary !== null ? baseSalary + extras : null;

      if (baseSalary !== null) {
        totalBaseSalaries += baseSalary;
      }
      totalExtras += extras;

      return {
        id: record?.id ?? null,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        baseSalary,
        extras,
        totalSalary,
        notes: record?.notes ?? null,
      };
    });

    return {
      year,
      month,
      monthStatus,
      users: userSalaries,
      totals: {
        baseSalaries: totalBaseSalaries,
        extras: totalExtras,
        total: totalBaseSalaries + totalExtras,
      },
    };
  }

  /**
   * Create or update a user's monthly salary entry.
   * If baseSalary is provided and different from current, updates User.salary and hourlyCost.
   */
  async upsertMonthlySalary(
    companyId: string,
    user: JwtPayload,
    dto: UpsertMonthlySalaryDto,
  ): Promise<MonthlySalaryResponse> {
    // Verify user exists in company
    const targetUser = await this.prisma.user.findFirst({
      where: { id: dto.userId, companyId, deletedAt: null },
    });

    if (!targetUser) {
      throw new NotFoundException(`Usuario con ID ${dto.userId} no encontrado`);
    }

    // Check if month is closed
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: {
        companyId_year_month: { companyId, year: dto.year, month: dto.month },
      },
    });
    const monthStatus =
      (closing?.status as MonthClosingStatus) ?? MonthClosingStatus.OPEN;
    let warning: string | undefined;

    // If month is closed, mark as reopened and add warning
    if (monthStatus === MonthClosingStatus.CLOSED) {
      await this.prisma.monthlyClosing.update({
        where: { id: closing!.id },
        data: {
          status: 'REOPENED',
          reopenedById: user.sub,
          reopenedAt: new Date(),
          reopenReason: 'Modificación de salario mensual',
        },
      });
      warning =
        'Este mes está cerrado. Los cambios recalcularán la distribución.';
    }

    // Update User.salary and hourlyCost if baseSalary provided and different
    let currentBaseSalary = targetUser.salary
      ? Number(targetUser.salary)
      : null;
    if (dto.baseSalary !== undefined && dto.baseSalary !== currentBaseSalary) {
      // Calculate new hourly cost (assuming 160 work hours/month)
      const newHourlyCost = dto.baseSalary / 160;

      await this.prisma.user.update({
        where: { id: dto.userId },
        data: {
          salary: dto.baseSalary,
          hourlyCost: Math.round(newHourlyCost * 100) / 100,
        },
      });
      currentBaseSalary = dto.baseSalary;
    }

    // Upsert the monthly salary record
    const record = await this.prisma.monthlyUserSalary.upsert({
      where: {
        companyId_userId_year_month: {
          companyId,
          userId: dto.userId,
          year: dto.year,
          month: dto.month,
        },
      },
      update: {
        extras: dto.extras ?? 0,
        notes: dto.notes,
      },
      create: {
        companyId,
        userId: dto.userId,
        year: dto.year,
        month: dto.month,
        extras: dto.extras ?? 0,
        notes: dto.notes,
      },
    });

    const baseSalary = currentBaseSalary ?? 0;
    const extras = Number(record.extras);

    return {
      id: record.id,
      userId: dto.userId,
      year: dto.year,
      month: dto.month,
      baseSalary,
      extras,
      totalSalary: baseSalary + extras,
      notes: record.notes,
      warning,
    };
  }

  /**
   * Delete a monthly salary extras entry.
   * Only deletes the MonthlyUserSalary record (extras), does NOT affect User.salary.
   */
  async deleteMonthlySalary(
    id: string,
    companyId: string,
    user: JwtPayload,
  ): Promise<void> {
    const record = await this.prisma.monthlyUserSalary.findUnique({
      where: { id },
    });

    if (!record || record.companyId !== companyId) {
      throw new NotFoundException(
        `Registro de salario con ID ${id} no encontrado`,
      );
    }

    // Check if month is closed
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: {
        companyId_year_month: {
          companyId,
          year: record.year,
          month: record.month,
        },
      },
    });

    if (closing?.status === 'CLOSED') {
      await this.prisma.monthlyClosing.update({
        where: { id: closing.id },
        data: {
          status: 'REOPENED',
          reopenedById: user.sub,
          reopenedAt: new Date(),
          reopenReason: 'Eliminación de registro de salario mensual',
        },
      });
    }

    await this.prisma.monthlyUserSalary.delete({ where: { id } });
  }

  // ==================== MONTHLY OVERHEAD COSTS ====================

  /**
   * Get all overhead costs for a specific month.
   */
  async getMonthlyOverhead(
    companyId: string,
    year: number,
    month: number,
  ): Promise<MonthlyOverheadResponse> {
    // Get month closing status
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });
    const monthStatus =
      (closing?.status as MonthClosingStatus) ?? MonthClosingStatus.OPEN;

    // Get overhead costs
    const costs = await this.prisma.monthlyOverheadCost.findMany({
      where: { companyId, year, month },
      orderBy: { createdAt: 'desc' },
    });

    const total = costs.reduce((sum, c) => sum + Number(c.amount), 0);

    return {
      year,
      month,
      monthStatus,
      costs: costs.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        costType: c.costType,
        description: c.description,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total,
    };
  }

  /**
   * Get overhead cost type options for dropdown.
   */
  getOverheadCostTypes(): OverheadCostTypeOption[] {
    return Object.values(OverheadCostType).map((value) => ({
      value,
      label: OverheadCostTypeLabels[value],
    }));
  }

  /**
   * Create a new overhead cost entry.
   */
  async createOverheadCost(
    companyId: string,
    user: JwtPayload,
    dto: CreateOverheadCostDto,
  ): Promise<OverheadCostResponse & { warning?: string }> {
    // Check if month is closed
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: {
        companyId_year_month: { companyId, year: dto.year, month: dto.month },
      },
    });
    let warning: string | undefined;

    if (closing?.status === 'CLOSED') {
      await this.prisma.monthlyClosing.update({
        where: { id: closing.id },
        data: {
          status: 'REOPENED',
          reopenedById: user.sub,
          reopenedAt: new Date(),
          reopenReason: 'Creación de gasto general',
        },
      });
      warning =
        'Este mes está cerrado. Los cambios recalcularán la distribución.';
    }

    const cost = await this.prisma.monthlyOverheadCost.create({
      data: {
        companyId,
        year: dto.year,
        month: dto.month,
        amount: dto.amount,
        costType: dto.costType,
        description: dto.description,
      },
    });

    return {
      id: cost.id,
      amount: Number(cost.amount),
      costType: cost.costType,
      description: cost.description,
      createdAt: cost.createdAt,
      updatedAt: cost.updatedAt,
      warning,
    };
  }

  /**
   * Update an existing overhead cost.
   */
  async updateOverheadCost(
    id: string,
    companyId: string,
    user: JwtPayload,
    dto: UpdateOverheadCostDto,
  ): Promise<OverheadCostResponse & { warning?: string }> {
    const existing = await this.prisma.monthlyOverheadCost.findUnique({
      where: { id },
    });

    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException(`Gasto general con ID ${id} no encontrado`);
    }

    // Check if month is closed
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: {
        companyId_year_month: {
          companyId,
          year: existing.year,
          month: existing.month,
        },
      },
    });
    let warning: string | undefined;

    if (closing?.status === 'CLOSED') {
      await this.prisma.monthlyClosing.update({
        where: { id: closing.id },
        data: {
          status: 'REOPENED',
          reopenedById: user.sub,
          reopenedAt: new Date(),
          reopenReason: 'Modificación de gasto general',
        },
      });
      warning =
        'Este mes está cerrado. Los cambios recalcularán la distribución.';
    }

    const cost = await this.prisma.monthlyOverheadCost.update({
      where: { id },
      data: {
        amount: dto.amount,
        costType: dto.costType,
        description: dto.description,
      },
    });

    return {
      id: cost.id,
      amount: Number(cost.amount),
      costType: cost.costType,
      description: cost.description,
      createdAt: cost.createdAt,
      updatedAt: cost.updatedAt,
      warning,
    };
  }

  /**
   * Delete an overhead cost entry.
   */
  async deleteOverheadCost(
    id: string,
    companyId: string,
    user: JwtPayload,
  ): Promise<void> {
    const existing = await this.prisma.monthlyOverheadCost.findUnique({
      where: { id },
    });

    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException(`Gasto general con ID ${id} no encontrado`);
    }

    // Check if month is closed
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: {
        companyId_year_month: {
          companyId,
          year: existing.year,
          month: existing.month,
        },
      },
    });

    if (closing?.status === 'CLOSED') {
      await this.prisma.monthlyClosing.update({
        where: { id: closing.id },
        data: {
          status: 'REOPENED',
          reopenedById: user.sub,
          reopenedAt: new Date(),
          reopenReason: 'Eliminación de gasto general',
        },
      });
    }

    await this.prisma.monthlyOverheadCost.delete({ where: { id } });
  }

  // ==================== MONTH CLOSING ====================

  /**
   * Get the closing status and distribution data for a month.
   */
  async getMonthlyClosing(
    companyId: string,
    year: number,
    month: number,
  ): Promise<MonthlyClosingResponse> {
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
      include: {
        closedBy: { select: { id: true, name: true } },
        reopenedBy: { select: { id: true, name: true } },
        distributions: {
          include: {
            project: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!closing) {
      return {
        id: null,
        year,
        month,
        status: MonthClosingStatus.OPEN,
        totalSalaries: null,
        totalOverhead: null,
        totalNonProductive: null,
        totalRevenue: null,
        closedBy: null,
        closedAt: null,
        reopenedBy: null,
        reopenedAt: null,
        reopenReason: null,
        distributions: null,
      };
    }

    // Map distributions and calculate total non-productive from sum
    const distributions =
      closing.status !== 'OPEN'
        ? closing.distributions.map((d) => ({
            projectId: d.projectId,
            projectName: d.project.name,
            projectCode: d.project.code,
            projectRevenue: Number(d.projectRevenue),
            revenueSharePercent: Number(d.revenueSharePercent),
            distributedSalaries: Number(d.distributedSalaries),
            distributedOverhead: Number(d.distributedOverhead),
            distributedNonProductive: d.distributedNonProductive
              ? Number(d.distributedNonProductive)
              : 0,
            totalDistributed: Number(d.totalDistributed),
          }))
        : null;

    // Calculate total non-productive from distributions
    const totalNonProductive =
      distributions?.reduce((sum, d) => sum + d.distributedNonProductive, 0) ??
      null;

    return {
      id: closing.id,
      year,
      month,
      status: closing.status as MonthClosingStatus,
      totalSalaries: closing.totalSalaries
        ? Number(closing.totalSalaries)
        : null,
      totalOverhead: closing.totalOverhead
        ? Number(closing.totalOverhead)
        : null,
      totalNonProductive,
      totalRevenue: closing.totalRevenue ? Number(closing.totalRevenue) : null,
      closedBy: closing.closedBy,
      closedAt: closing.closedAt,
      reopenedBy: closing.reopenedBy,
      reopenedAt: closing.reopenedAt,
      reopenReason: closing.reopenReason,
      distributions,
    };
  }

  /**
   * Preview what the distribution would look like WITHOUT actually closing.
   * Now includes non-productive costs distribution.
   */
  async previewDistribution(
    companyId: string,
    year: number,
    month: number,
  ): Promise<DistributionPreviewResponse> {
    const validationErrors: ValidationError[] = [];

    // Calculate user cost/hours for the month (includes non-GUEST users regardless of isActive)
    const userCostHours = await this.calculateUsersMonthlyCostHour(
      companyId,
      year,
      month,
    );

    // Get active non-GUEST users to validate salaries for UI purposes
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        isActive: true,
        deletedAt: null,
        relation: { not: 'GUEST' },
      },
      select: { id: true, name: true, salary: true },
    });

    // Get monthly salary extras
    const salaryRecords = await this.prisma.monthlyUserSalary.findMany({
      where: { companyId, year, month },
    });
    const salaryByUser = new Map(salaryRecords.map((s) => [s.userId, s]));

    // Calculate total salaries from active users and check for missing
    let totalSalaries = 0;
    for (const user of users) {
      const record = salaryByUser.get(user.id);
      const baseSalary = user.salary ? Number(user.salary) : null;
      const extras = record ? Number(record.extras) : 0;

      if (baseSalary === null) {
        validationErrors.push({
          type: 'MISSING_SALARY',
          message: `El usuario ${user.name} no tiene salario base configurado`,
          details: { userId: user.id, userName: user.name },
        });
      } else {
        totalSalaries += baseSalary + extras;
      }
    }

    // Get overhead costs
    const overheadCosts = await this.prisma.monthlyOverheadCost.findMany({
      where: { companyId, year, month },
    });
    const totalOverhead = overheadCosts.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );

    // Calculate non-productive costs (hours on "No productivos" + zero-hour salaries)
    const nonProductiveCostsData = await this.calculateNonProductiveCosts(
      companyId,
      year,
      month,
      userCostHours,
    );
    const totalNonProductive = nonProductiveCostsData.nonProductiveCost;

    // Get non-productive project IDs to exclude from distribution
    const nonProductiveProjectIds =
      await this.getNonProductiveProjectIds(companyId);

    // Get active projects excluding non-productive ones
    const allProjects = await this.prisma.project.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true },
    });

    // Filter to productive projects only for distribution
    const productiveProjects = allProjects.filter(
      (p) => !nonProductiveProjectIds.has(p.id),
    );

    if (productiveProjects.length === 0) {
      validationErrors.push({
        type: 'NO_ACTIVE_PROJECTS',
        message: 'No hay proyectos productivos activos para distribuir costes',
      });
    }

    // Get revenues for productive projects
    const revenues = await this.prisma.projectMonthlyRevenue.findMany({
      where: {
        projectId: { in: productiveProjects.map((p) => p.id) },
        year,
        month,
      },
    });
    const revenueByProject = new Map(revenues.map((r) => [r.projectId, r]));

    // Check for missing revenues and calculate total
    let totalRevenue = 0;
    for (const project of productiveProjects) {
      const revenue = revenueByProject.get(project.id);
      if (!revenue || revenue.actualRevenue === null) {
        validationErrors.push({
          type: 'MISSING_REVENUE',
          message: `El proyecto ${project.name} no tiene ingresos reales configurados`,
          details: { projectId: project.id, projectName: project.name },
        });
      } else {
        totalRevenue += Number(revenue.actualRevenue);
      }
    }

    // Warn if total revenue is zero
    if (
      totalRevenue === 0 &&
      productiveProjects.length > 0 &&
      validationErrors.filter((e) => e.type === 'MISSING_REVENUE').length === 0
    ) {
      validationErrors.push({
        type: 'ZERO_REVENUE',
        message:
          'El total de ingresos es cero. Los costes se distribuirán equitativamente.',
      });
    }

    // Calculate distributions for productive projects only
    const distributions: ProjectDistribution[] = productiveProjects.map(
      (project) => {
        const revenue = revenueByProject.get(project.id);
        const projectRevenue = revenue?.actualRevenue
          ? Number(revenue.actualRevenue)
          : 0;

        let revenueSharePercent: number;
        if (totalRevenue === 0) {
          // Distribute equally if no revenue
          revenueSharePercent = 100 / productiveProjects.length;
        } else {
          revenueSharePercent = (projectRevenue / totalRevenue) * 100;
        }

        const distributedSalaries = (totalSalaries * revenueSharePercent) / 100;
        const distributedOverhead = (totalOverhead * revenueSharePercent) / 100;
        const distributedNonProductive =
          (totalNonProductive * revenueSharePercent) / 100;

        return {
          projectId: project.id,
          projectName: project.name,
          projectCode: project.code,
          projectRevenue,
          revenueSharePercent: Math.round(revenueSharePercent * 100) / 100,
          distributedSalaries: Math.round(distributedSalaries * 100) / 100,
          distributedOverhead: Math.round(distributedOverhead * 100) / 100,
          distributedNonProductive:
            Math.round(distributedNonProductive * 100) / 100,
          totalDistributed:
            Math.round(
              (distributedSalaries +
                distributedOverhead +
                distributedNonProductive) *
                100,
            ) / 100,
        };
      },
    );

    const canClose = validationErrors.length === 0;

    return {
      year,
      month,
      canClose,
      validationErrors,
      totalSalaries,
      totalOverhead,
      totalNonProductive,
      totalRevenue,
      distributions,
    };
  }

  /**
   * Close the month. Creates distribution records and snapshots salary data.
   */
  async closeMonth(
    companyId: string,
    user: JwtPayload,
    year: number,
    month: number,
  ): Promise<CloseMonthResponse> {
    // Get preview to validate
    const preview = await this.previewDistribution(companyId, year, month);

    if (!preview.canClose) {
      throw new BadRequestException({
        message: 'No se puede cerrar el mes. Hay errores de validación.',
        errors: preview.validationErrors,
      });
    }

    // Check if already closed
    const existingClosing = await this.prisma.monthlyClosing.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });

    if (existingClosing?.status === 'CLOSED') {
      throw new BadRequestException('Este mes ya está cerrado');
    }

    // Execute closing in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Snapshot base salaries for all active non-GUEST users
      const users = await tx.user.findMany({
        where: {
          companyId,
          isActive: true,
          deletedAt: null,
          relation: { not: 'GUEST' },
        },
        select: { id: true, salary: true },
      });

      for (const u of users) {
        if (u.salary !== null) {
          await tx.monthlyUserSalary.upsert({
            where: {
              companyId_userId_year_month: {
                companyId,
                userId: u.id,
                year,
                month,
              },
            },
            update: {
              baseSalarySnapshot: u.salary,
            },
            create: {
              companyId,
              userId: u.id,
              year,
              month,
              baseSalarySnapshot: u.salary,
              extras: 0,
            },
          });
        }
      }

      // Create or update closing record
      const closing = await tx.monthlyClosing.upsert({
        where: { companyId_year_month: { companyId, year, month } },
        update: {
          status: 'CLOSED',
          totalSalaries: preview.totalSalaries,
          totalOverhead: preview.totalOverhead,
          totalRevenue: preview.totalRevenue,
          closedById: user.sub,
          closedAt: new Date(),
          reopenedById: null,
          reopenedAt: null,
          reopenReason: null,
        },
        create: {
          companyId,
          year,
          month,
          status: 'CLOSED',
          totalSalaries: preview.totalSalaries,
          totalOverhead: preview.totalOverhead,
          totalRevenue: preview.totalRevenue,
          closedById: user.sub,
          closedAt: new Date(),
        },
      });

      // Delete existing distributions if reopening
      await tx.projectMonthlyDistribution.deleteMany({
        where: { closingId: closing.id },
      });

      // Create distribution records
      for (const dist of preview.distributions) {
        // Note: distributedNonProductive will be recognized after `pnpm prisma generate`
        await tx.projectMonthlyDistribution.create({
          data: {
            closingId: closing.id,
            projectId: dist.projectId,
            projectRevenue: dist.projectRevenue,
            revenueSharePercent: dist.revenueSharePercent,
            distributedSalaries: dist.distributedSalaries,
            distributedOverhead: dist.distributedOverhead,
            distributedNonProductive: dist.distributedNonProductive,
            totalDistributed: dist.totalDistributed,
          } as Parameters<
            typeof tx.projectMonthlyDistribution.create
          >[0]['data'],
        });
      }
    });

    // Return the updated closing
    const closingResponse = await this.getMonthlyClosing(
      companyId,
      year,
      month,
    );
    return { success: true, closing: closingResponse };
  }

  /**
   * Reopen a closed month.
   */
  async reopenMonth(
    companyId: string,
    user: JwtPayload,
    year: number,
    month: number,
    dto: ReopenMonthDto,
  ): Promise<MonthlyClosingResponse> {
    const closing = await this.prisma.monthlyClosing.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });

    if (!closing) {
      throw new NotFoundException('No existe cierre para este mes');
    }

    if (closing.status === 'OPEN') {
      throw new BadRequestException('Este mes no está cerrado');
    }

    await this.prisma.monthlyClosing.update({
      where: { id: closing.id },
      data: {
        status: 'REOPENED',
        reopenedById: user.sub,
        reopenedAt: new Date(),
        reopenReason: dto.reason,
      },
    });

    return this.getMonthlyClosing(companyId, year, month);
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
      description: actual.description,
      isBilled: actual.isBilled,
      issueDate: actual.issueDate,
      createdAt: actual.createdAt,
      updatedAt: actual.updatedAt,
    };
  }
}
