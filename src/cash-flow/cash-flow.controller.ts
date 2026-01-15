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
import { CashFlowFeatureGuard } from '../auth/cash-flow-feature.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import {
  CashFlowService,
  type MonthlyRevenueResponse,
  type CostEstimateResponse,
  type CostActualResponse,
  type FullMonthlyCashFlowResponse,
  type AllProjectsCashFlowResponse,
} from './cash-flow.service.js';
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

type RequestWithUser = Request & { user: JwtPayload };

@Controller('cash-flow')
@UseGuards(JwtAuthGuard, CashFlowFeatureGuard, TeamLeaderGuard)
export class CashFlowController {
  constructor(private readonly cashFlowService: CashFlowService) {}

  // ==================== ALL PROJECTS SUMMARY ====================

  /**
   * GET /cash-flow/projects-summary
   * Returns cash flow data for all projects the user has access to.
   * - Admin/Owner: All company projects
   * - Team Leader: Only their team's projects
   */
  @Get('projects-summary')
  getAllProjectsCashFlow(
    @Query() query: AllProjectsQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<AllProjectsCashFlowResponse> {
    return this.cashFlowService.getAllProjectsCashFlow(
      req.user.companyId,
      req.user,
      query.year,
      query.month,
    );
  }

  // ==================== MONTHLY REVENUE ====================

  @Get('projects/:projectId/revenue')
  getMonthlyRevenues(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: MonthlyRevenueQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<MonthlyRevenueResponse[]> {
    return this.cashFlowService.getMonthlyRevenues(
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
    return this.cashFlowService.upsertMonthlyRevenue(
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
    return this.cashFlowService.getCostEstimates(
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
    return this.cashFlowService.createCostEstimate(
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
    return this.cashFlowService.updateCostEstimate(
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
    return this.cashFlowService.deleteCostEstimate(
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
    return this.cashFlowService.getCostActuals(
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
    return this.cashFlowService.createCostActual(
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
    return this.cashFlowService.updateCostActual(
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
    return this.cashFlowService.deleteCostActual(
      id,
      req.user.companyId,
      req.user,
    );
  }

  // ==================== FULL MONTHLY VIEW ====================

  @Get('projects/:projectId/monthly/:year/:month')
  getFullMonthlyCashFlow(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Req() req: RequestWithUser,
  ): Promise<FullMonthlyCashFlowResponse> {
    return this.cashFlowService.getFullMonthlyCashFlow(
      projectId,
      year,
      month,
      req.user.companyId,
      req.user,
    );
  }
}
