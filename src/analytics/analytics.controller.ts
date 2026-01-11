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
import { TeamScopeService } from '../auth/team-scope.service.js';
import { AnalyticsService } from './analytics.service.js';
import type { ProjectBreakdownResponse } from './dto/project-breakdown.dto.js';
import type { ProjectsSummaryResponse } from './dto/projects-summary.dto.js';
import {
  WorkerBreakdownQueryDto,
  type WorkerBreakdownResponse,
} from './dto/worker-breakdown.dto.js';
import type { WorkersSummaryResponse } from './dto/workers-summary.dto.js';

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
   * Note: All users see all projects analytics (projects are company-wide)
   */
  @Get('projects-summary')
  getProjectsSummary(
    @Req() req: RequestWithUser,
  ): Promise<ProjectsSummaryResponse> {
    return this.analyticsService.getProjectsSummary(req.user.companyId);
  }

  /**
   * GET /analytics/projects/:projectId/breakdown
   * Returns per-worker breakdown for a specific project
   * Note: All users see all project analytics (projects are company-wide)
   */
  @Get('projects/:projectId/breakdown')
  getProjectBreakdown(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: RequestWithUser,
  ): Promise<ProjectBreakdownResponse> {
    return this.analyticsService.getProjectBreakdown(
      projectId,
      req.user.companyId,
    );
  }

  /**
   * GET /analytics/workers-summary
   * Returns aggregated data for all active workers (users + externals)
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
   * Query param: type (required) - 'internal' or 'external'
   * Team leaders can only access their team members
   */
  @Get('workers/:workerId/breakdown')
  async getWorkerBreakdown(
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @Query() query: WorkerBreakdownQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<WorkerBreakdownResponse> {
    // For internal workers, check team scope
    if (query.type === 'internal') {
      const canAccess = await this.teamScopeService.canAccessUser(
        req.user,
        workerId,
      );
      if (!canAccess) {
        throw new ForbiddenException(
          'No tienes acceso a las analíticas de este trabajador',
        );
      }
    }
    // External workers are managed at company level, only full admins can access
    if (
      query.type === 'external' &&
      !this.teamScopeService.isFullAdmin(req.user)
    ) {
      throw new ForbiddenException(
        'No tienes acceso a las analíticas de trabajadores externos',
      );
    }

    return this.analyticsService.getWorkerBreakdown(
      workerId,
      query.type,
      req.user.companyId,
    );
  }
}
