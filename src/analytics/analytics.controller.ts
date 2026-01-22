import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TeamLeaderGuard } from '../auth/team-leader.guard.js';
import { ProjectsFeatureGuard } from '../auth/projects-feature.guard.js';
import { TeamScopeService } from '../auth/team-scope.service.js';
import { AnalyticsService } from './analytics.service.js';
import type { ProjectBreakdownResponse } from './dto/project-breakdown.dto.js';
import type { ProjectsSummaryResponse } from './dto/projects-summary.dto.js';
import type { WorkerBreakdownResponse } from './dto/worker-breakdown.dto.js';
import type { WorkersSummaryResponse } from './dto/workers-summary.dto.js';
import {
  PayrollSummaryQueryDto,
  type PayrollSummaryResponse,
} from './dto/payroll-summary.dto.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('analytics')
@UseGuards(JwtAuthGuard, TeamLeaderGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly teamScopeService: TeamScopeService,
  ) {}

  /**
   * GET /analytics/projects-summary
   * Returns aggregated data for all active projects
   * Team leaders only see projects assigned to their team,
   * with aggregated data limited to their team members only
   */
  @Get('projects-summary')
  @UseGuards(ProjectsFeatureGuard)
  async getProjectsSummary(
    @Req() req: RequestWithUser,
  ): Promise<ProjectsSummaryResponse> {
    const userIds = await this.teamScopeService.getUserIdsInScope(req.user);
    // For team leaders, also filter projects by teamId
    const teamId = this.teamScopeService.isFullAdmin(req.user)
      ? null
      : req.user.teamId;
    return this.analyticsService.getProjectsSummary(req.user.companyId, {
      userIds,
      teamId,
    });
  }

  /**
   * GET /analytics/projects/:projectId/breakdown
   * Returns per-worker breakdown for a specific project
   * Team leaders only see their team members' contributions
   */
  @Get('projects/:projectId/breakdown')
  @UseGuards(ProjectsFeatureGuard)
  async getProjectBreakdown(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: RequestWithUser,
  ): Promise<ProjectBreakdownResponse> {
    const userIds = await this.teamScopeService.getUserIdsInScope(req.user);
    // For team leaders, also verify project belongs to their team
    const teamId = this.teamScopeService.isFullAdmin(req.user)
      ? null
      : req.user.teamId;
    return this.analyticsService.getProjectBreakdown(
      projectId,
      req.user.companyId,
      { userIds, teamId },
    );
  }

  /**
   * GET /analytics/workers-summary
   * Returns aggregated data for all active workers
   * Team leaders only see their team members
   */
  @Get('workers-summary')
  async getWorkersSummary(
    @Req() req: RequestWithUser,
  ): Promise<WorkersSummaryResponse> {
    const userIds = await this.teamScopeService.getUserIdsInScope(req.user);
    return this.analyticsService.getWorkersSummary(req.user.companyId, {
      userIds,
    });
  }

  /**
   * GET /analytics/workers/:workerId/breakdown
   * Returns per-project breakdown for a specific worker
   * Team leaders can only access their team members
   * Requires projects feature to be enabled
   */
  @Get('workers/:workerId/breakdown')
  @UseGuards(ProjectsFeatureGuard)
  async getWorkerBreakdown(
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @Req() req: RequestWithUser,
  ): Promise<WorkerBreakdownResponse> {
    const canAccess = await this.teamScopeService.canAccessUser(
      req.user,
      workerId,
    );
    if (!canAccess) {
      throw new ForbiddenException(
        'No tienes acceso a las analíticas de este trabajador',
      );
    }

    return this.analyticsService.getWorkerBreakdown(
      workerId,
      req.user.companyId,
    );
  }

  /**
   * GET /analytics/payroll-summary
   * Returns payroll summary for all users in the given date range
   * Includes expected vs logged hours, absence breakdowns, and cost calculations
   * Team leaders only see their team members
   */
  @Get('payroll-summary')
  async getPayrollSummary(
    @Query() query: PayrollSummaryQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<PayrollSummaryResponse> {
    const userIds = await this.teamScopeService.getUserIdsInScope(req.user);
    return this.analyticsService.getPayrollSummary(
      req.user.companyId,
      query.startDate,
      query.endDate,
      { userIds },
    );
  }
}
