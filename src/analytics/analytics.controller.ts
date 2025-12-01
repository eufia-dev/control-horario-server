import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { AnalyticsService } from './analytics.service.js';
import type { ProjectsSummaryResponse } from './dto/projects-summary.dto.js';
import type { ProjectBreakdownResponse } from './dto/project-breakdown.dto.js';
import type { WorkersSummaryResponse } from './dto/workers-summary.dto.js';
import {
  WorkerBreakdownQueryDto,
  type WorkerBreakdownResponse,
} from './dto/worker-breakdown.dto.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/projects-summary
   * Returns aggregated data for all active projects
   */
  @Get('projects-summary')
  getProjectsSummary(
    @Req() req: RequestWithUser,
  ): Promise<ProjectsSummaryResponse> {
    return this.analyticsService.getProjectsSummary(req.user.organizationId);
  }

  /**
   * GET /analytics/projects/:projectId/breakdown
   * Returns per-worker breakdown for a specific project
   */
  @Get('projects/:projectId/breakdown')
  getProjectBreakdown(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: RequestWithUser,
  ): Promise<ProjectBreakdownResponse> {
    return this.analyticsService.getProjectBreakdown(
      projectId,
      req.user.organizationId,
    );
  }

  /**
   * GET /analytics/workers-summary
   * Returns aggregated data for all active workers (users + externals)
   */
  @Get('workers-summary')
  getWorkersSummary(
    @Req() req: RequestWithUser,
  ): Promise<WorkersSummaryResponse> {
    return this.analyticsService.getWorkersSummary(req.user.organizationId);
  }

  /**
   * GET /analytics/workers/:workerId/breakdown
   * Returns per-project breakdown for a specific worker
   * Query param: type (required) - 'internal' or 'external'
   */
  @Get('workers/:workerId/breakdown')
  getWorkerBreakdown(
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @Query() query: WorkerBreakdownQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<WorkerBreakdownResponse> {
    return this.analyticsService.getWorkerBreakdown(
      workerId,
      query.type,
      req.user.organizationId,
    );
  }
}
