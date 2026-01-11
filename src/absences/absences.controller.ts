import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AbsenceStatus } from '@prisma/client';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotGuestGuard } from '../auth/not-guest.guard.js';
import { TeamLeaderGuard } from '../auth/team-leader.guard.js';
import { TeamScopeService } from '../auth/team-scope.service.js';
import {
  AbsencesService,
  type AbsenceResponse,
  type AbsenceStats,
  type AbsenceTypeOption,
} from './absences.service.js';
import { CreateAbsenceDto } from './dto/create-absence.dto.js';
import { ReviewAbsenceDto } from './dto/review-absence.dto.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('absences')
@UseGuards(JwtAuthGuard)
export class AbsencesController {
  constructor(
    private readonly absencesService: AbsencesService,
    private readonly teamScopeService: TeamScopeService,
  ) {}

  /**
   * GET /absences/types
   * Get absence type enum values for dropdown
   */
  @Get('types')
  getTypes(): AbsenceTypeOption[] {
    return this.absencesService.getTypes();
  }

  /**
   * GET /absences/stats
   * Get absence statistics for the company (admin/team leader)
   */
  @Get('stats')
  @UseGuards(TeamLeaderGuard)
  async getStats(@Req() req: RequestWithUser): Promise<AbsenceStats> {
    const userIds = await this.teamScopeService.getUserIdsInScope(req.user);
    return this.absencesService.getAbsenceStats(req.user.companyId, userIds);
  }

  /**
   * GET /absences/me
   * Get current user's absences
   */
  @Get('me')
  async getMyAbsences(
    @Req() req: RequestWithUser,
    @Query('status') status?: AbsenceStatus,
  ): Promise<AbsenceResponse[]> {
    return this.absencesService.getMyAbsences(
      req.user.sub,
      req.user.companyId,
      status,
    );
  }

  /**
   * POST /absences
   * Request a new absence
   */
  @Post()
  @UseGuards(NotGuestGuard)
  async createAbsence(
    @Body() dto: CreateAbsenceDto,
    @Req() req: RequestWithUser,
  ): Promise<AbsenceResponse> {
    return this.absencesService.requestAbsence(
      req.user.sub,
      req.user.companyId,
      dto,
    );
  }

  /**
   * DELETE /absences/:id
   * Cancel a pending absence (user can only cancel their own)
   */
  @Delete(':id')
  @UseGuards(NotGuestGuard)
  async cancelAbsence(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<AbsenceResponse> {
    return this.absencesService.cancelAbsence(req.user.sub, id);
  }

  /**
   * GET /absences
   * Get all company absences (admin/team leader - team scoped)
   */
  @Get()
  @UseGuards(TeamLeaderGuard)
  async getAllAbsences(
    @Req() req: RequestWithUser,
    @Query('status') status?: AbsenceStatus,
    @Query('userId') userId?: string,
  ): Promise<AbsenceResponse[]> {
    const userIds = await this.teamScopeService.getUserIdsInScope(req.user);
    return this.absencesService.getAllAbsences(req.user.companyId, {
      status,
      userId,
      userIds,
    });
  }

  /**
   * GET /absences/:id
   * Get a single absence by ID (admin/team leader - must have access to the user)
   */
  @Get(':id')
  @UseGuards(TeamLeaderGuard)
  async getAbsence(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<AbsenceResponse> {
    const absence = await this.absencesService.getAbsenceById(
      id,
      req.user.companyId,
    );
    // Check if user has access to the absence's user
    const canAccess = await this.teamScopeService.canAccessUser(
      req.user,
      absence.userId,
    );
    if (!canAccess) {
      throw new ForbiddenException('No tienes acceso a esta ausencia');
    }
    return absence;
  }

  /**
   * PATCH /absences/:id/review
   * Approve or reject an absence request (admin/team leader - must have access to the user)
   */
  @Patch(':id/review')
  @UseGuards(TeamLeaderGuard)
  async reviewAbsence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAbsenceDto,
    @Req() req: RequestWithUser,
  ): Promise<AbsenceResponse> {
    // First get the absence to check permissions
    const absence = await this.absencesService.getAbsenceById(
      id,
      req.user.companyId,
    );
    // Check if user has access to the absence's user
    const canAccess = await this.teamScopeService.canAccessUser(
      req.user,
      absence.userId,
    );
    if (!canAccess) {
      throw new ForbiddenException(
        'No tienes acceso para revisar esta ausencia',
      );
    }
    return this.absencesService.reviewAbsence(
      id,
      req.user.sub,
      req.user.companyId,
      dto,
    );
  }
}
