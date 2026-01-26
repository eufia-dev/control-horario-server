import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TeamLeaderGuard } from '../auth/team-leader.guard.js';
import { CostsFeatureGuard } from '../auth/costs-feature.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import {
  CostsService,
  type MonthlyRevenueResponse,
  type CostEstimateResponse,
  type CostActualResponse,
  type FullMonthlyCostsResponse,
  type AllProjectsCostsResponse,
  type AnnualCostsResponse,
  type MonthlySalariesResponse,
  type MonthlySalaryResponse,
  type MonthlyOverheadResponse,
  type OverheadCostResponse,
  type OverheadCostTypeOption,
  type MonthlyClosingResponse,
  type DistributionPreviewResponse,
  type CloseMonthResponse,
} from './costs.service.js';
import {
  UpsertMonthlyRevenueDto,
  MonthlyRevenueQueryDto,
} from './dto/upsert-monthly-revenue.dto.js';
import { CreateCostEstimateDto } from './dto/create-cost-estimate.dto.js';
import { UpdateCostEstimateDto } from './dto/update-cost-estimate.dto.js';
import { CreateCostActualDto } from './dto/create-cost-actual.dto.js';
import { UpdateCostActualDto } from './dto/update-cost-actual.dto.js';
import { ExternalCostQueryDto } from './dto/external-cost-query.dto.js';
import { AllProjectsQueryDto } from './dto/all-projects-query.dto.js';
import { AnnualCostsQueryDto } from './dto/annual-costs-query.dto.js';
import { SaveAnnualCostsDto } from './dto/save-annual-costs.dto.js';
import {
  MonthlySalaryQueryDto,
  UpsertMonthlySalaryDto,
} from './dto/monthly-salary.dto.js';
import {
  MonthlyOverheadQueryDto,
  CreateOverheadCostDto,
  UpdateOverheadCostDto,
} from './dto/monthly-overhead.dto.js';
import { ReopenMonthDto } from './dto/month-closing.dto.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('costs')
@UseGuards(JwtAuthGuard, CostsFeatureGuard, TeamLeaderGuard)
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  // ==================== ALL PROJECTS SUMMARY ====================

  /**
   * GET /costs/projects-summary
   * Returns costs data for all projects the user has access to.
   * - Admin/Owner: All company projects
   * - Team Leader: Only their team's projects
   */
  @Get('projects-summary')
  getAllProjectsCosts(
    @Query() query: AllProjectsQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<AllProjectsCostsResponse> {
    return this.costsService.getAllProjectsCosts(
      req.user.companyId,
      req.user,
      query.year,
      query.month,
    );
  }

  // ==================== ANNUAL COSTS ====================

  /**
   * GET /costs/projects-annual?year=2026
   * Returns full annual costs data for all projects the user has access to.
   * Includes revenue, cost estimates, and cost actuals for each month.
   * - Admin/Owner: All company projects
   * - Team Leader: Only their team's projects
   */
  @Get('projects-annual')
  getAnnualProjectsCosts(
    @Query() query: AnnualCostsQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<AnnualCostsResponse> {
    return this.costsService.getAnnualProjectsCosts(
      req.user.companyId,
      req.user,
      query.year,
    );
  }

  /**
   * POST /costs/projects-annual
   * Bulk save annual costs data (revenue upserts and cost estimate operations).
   * Validates project access for each item.
   */
  @Post('projects-annual')
  saveAnnualCosts(
    @Body() dto: SaveAnnualCostsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.costsService.saveAnnualCosts(req.user.companyId, req.user, dto);
  }

  // ==================== MONTHLY REVENUE ====================

  @Get('projects/:projectId/revenue')
  getMonthlyRevenues(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: MonthlyRevenueQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<MonthlyRevenueResponse[]> {
    return this.costsService.getMonthlyRevenues(
      projectId,
      req.user.companyId,
      req.user,
      query.year,
    );
  }

  @Put('projects/:projectId/revenue/:year/:month')
  upsertMonthlyRevenue(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: UpsertMonthlyRevenueDto,
    @Req() req: RequestWithUser,
  ): Promise<MonthlyRevenueResponse> {
    return this.costsService.upsertMonthlyRevenue(
      projectId,
      year,
      month,
      req.user.companyId,
      req.user,
      dto,
    );
  }

  // ==================== COST ESTIMATES ====================

  @Get('projects/:projectId/cost-estimates')
  getCostEstimates(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ExternalCostQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<CostEstimateResponse[]> {
    return this.costsService.getCostEstimates(
      projectId,
      req.user.companyId,
      req.user,
      query.year,
      query.month,
    );
  }

  @Post('projects/:projectId/cost-estimates')
  createCostEstimate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateCostEstimateDto,
    @Req() req: RequestWithUser,
  ): Promise<CostEstimateResponse> {
    return this.costsService.createCostEstimate(
      projectId,
      req.user.companyId,
      req.user,
      dto,
    );
  }

  @Patch('cost-estimates/:id')
  updateCostEstimate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCostEstimateDto,
    @Req() req: RequestWithUser,
  ): Promise<CostEstimateResponse> {
    return this.costsService.updateCostEstimate(
      id,
      req.user.companyId,
      req.user,
      dto,
    );
  }

  @Delete('cost-estimates/:id')
  deleteCostEstimate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.costsService.deleteCostEstimate(
      id,
      req.user.companyId,
      req.user,
    );
  }

  // ==================== COST ACTUALS ====================

  @Get('projects/:projectId/cost-actuals')
  getCostActuals(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ExternalCostQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<CostActualResponse[]> {
    return this.costsService.getCostActuals(
      projectId,
      req.user.companyId,
      req.user,
      query.year,
      query.month,
    );
  }

  @Post('projects/:projectId/cost-actuals')
  createCostActual(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateCostActualDto,
    @Req() req: RequestWithUser,
  ): Promise<CostActualResponse> {
    return this.costsService.createCostActual(
      projectId,
      req.user.companyId,
      req.user,
      dto,
    );
  }

  @Patch('cost-actuals/:id')
  updateCostActual(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCostActualDto,
    @Req() req: RequestWithUser,
  ): Promise<CostActualResponse> {
    return this.costsService.updateCostActual(
      id,
      req.user.companyId,
      req.user,
      dto,
    );
  }

  @Delete('cost-actuals/:id')
  deleteCostActual(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.costsService.deleteCostActual(id, req.user.companyId, req.user);
  }

  // ==================== FULL MONTHLY VIEW ====================

  @Get('projects/:projectId/monthly/:year/:month')
  getFullMonthlyCosts(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Req() req: RequestWithUser,
  ): Promise<FullMonthlyCostsResponse> {
    return this.costsService.getFullMonthlyCosts(
      projectId,
      year,
      month,
      req.user.companyId,
      req.user,
    );
  }

  // ==================== MONTHLY SALARIES ====================

  /**
   * GET /costs/monthly-salaries?year&month
   * Returns all active users with their salary data for the specified month.
   */
  @Get('monthly-salaries')
  getMonthlySalaries(
    @Query() query: MonthlySalaryQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<MonthlySalariesResponse> {
    return this.costsService.getMonthlySalaries(
      req.user.companyId,
      query.year,
      query.month,
    );
  }

  /**
   * POST /costs/monthly-salaries
   * Create or update a user's monthly salary entry.
   * If baseSalary is provided and different, updates User.salary and hourlyCost.
   */
  @Post('monthly-salaries')
  upsertMonthlySalary(
    @Body() dto: UpsertMonthlySalaryDto,
    @Req() req: RequestWithUser,
  ): Promise<MonthlySalaryResponse> {
    return this.costsService.upsertMonthlySalary(
      req.user.companyId,
      req.user,
      dto,
    );
  }

  /**
   * DELETE /costs/monthly-salaries/:id
   * Delete a monthly salary extras entry.
   * Only deletes the extras record, does NOT affect User.salary.
   */
  @Delete('monthly-salaries/:id')
  deleteMonthlySalary(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.costsService.deleteMonthlySalary(
      id,
      req.user.companyId,
      req.user,
    );
  }

  // ==================== MONTHLY OVERHEAD COSTS ====================

  /**
   * GET /costs/monthly-overhead?year&month
   * Returns all overhead costs for the specified month.
   */
  @Get('monthly-overhead')
  getMonthlyOverhead(
    @Query() query: MonthlyOverheadQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<MonthlyOverheadResponse> {
    return this.costsService.getMonthlyOverhead(
      req.user.companyId,
      query.year,
      query.month,
    );
  }

  /**
   * GET /costs/overhead-cost-types
   * Returns available overhead cost types for dropdown.
   */
  @Get('overhead-cost-types')
  getOverheadCostTypes(): OverheadCostTypeOption[] {
    return this.costsService.getOverheadCostTypes();
  }

  /**
   * POST /costs/monthly-overhead
   * Create a new overhead cost entry.
   */
  @Post('monthly-overhead')
  createOverheadCost(
    @Body() dto: CreateOverheadCostDto,
    @Req() req: RequestWithUser,
  ): Promise<OverheadCostResponse & { warning?: string }> {
    return this.costsService.createOverheadCost(
      req.user.companyId,
      req.user,
      dto,
    );
  }

  /**
   * PATCH /costs/monthly-overhead/:id
   * Update an existing overhead cost.
   */
  @Patch('monthly-overhead/:id')
  updateOverheadCost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOverheadCostDto,
    @Req() req: RequestWithUser,
  ): Promise<OverheadCostResponse & { warning?: string }> {
    return this.costsService.updateOverheadCost(
      id,
      req.user.companyId,
      req.user,
      dto,
    );
  }

  /**
   * DELETE /costs/monthly-overhead/:id
   * Delete an overhead cost entry.
   */
  @Delete('monthly-overhead/:id')
  deleteOverheadCost(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.costsService.deleteOverheadCost(
      id,
      req.user.companyId,
      req.user,
    );
  }

  // ==================== MONTH CLOSING ====================

  /**
   * GET /costs/monthly-closing/:year/:month
   * Get the closing status and distribution data for a month.
   */
  @Get('monthly-closing/:year/:month')
  getMonthlyClosing(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Req() req: RequestWithUser,
  ): Promise<MonthlyClosingResponse> {
    return this.costsService.getMonthlyClosing(req.user.companyId, year, month);
  }

  /**
   * GET /costs/monthly-closing/:year/:month/preview
   * Preview what the distribution would look like WITHOUT actually closing.
   */
  @Get('monthly-closing/:year/:month/preview')
  previewDistribution(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Req() req: RequestWithUser,
  ): Promise<DistributionPreviewResponse> {
    return this.costsService.previewDistribution(
      req.user.companyId,
      year,
      month,
    );
  }

  /**
   * POST /costs/monthly-closing/:year/:month/close
   * Close the month. Creates distribution records and snapshots salary data.
   */
  @Post('monthly-closing/:year/:month/close')
  closeMonth(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Req() req: RequestWithUser,
  ): Promise<CloseMonthResponse> {
    return this.costsService.closeMonth(
      req.user.companyId,
      req.user,
      year,
      month,
    );
  }

  /**
   * POST /costs/monthly-closing/:year/:month/reopen
   * Reopen a closed month. Only ADMIN/OWNER can do this.
   */
  @Post('monthly-closing/:year/:month/reopen')
  reopenMonth(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: ReopenMonthDto,
    @Req() req: RequestWithUser,
  ): Promise<MonthlyClosingResponse> {
    return this.costsService.reopenMonth(
      req.user.companyId,
      req.user,
      year,
      month,
      dto,
    );
  }
}
