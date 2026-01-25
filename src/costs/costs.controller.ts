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
}
