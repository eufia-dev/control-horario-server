import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateAbsenceDto } from './dto/create-absence.dto.js';
import { ReviewAbsenceDto } from './dto/review-absence.dto.js';
import {
  AbsencesService,
  type AbsenceResponse,
  type AbsenceTypeOption,
  type AbsenceStats,
} from './absences.service.js';
import type { AbsenceStatus } from '@prisma/client';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('absences')
@UseGuards(JwtAuthGuard)
export class AbsencesController {
  constructor(private readonly absencesService: AbsencesService) {}

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
   * Get absence statistics for the company (admin only)
   */
  @Get('stats')
  @UseGuards(AdminGuard)
  async getStats(@Req() req: RequestWithUser): Promise<AbsenceStats> {
    return this.absencesService.getAbsenceStats(req.user.companyId);
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
  async cancelAbsence(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<AbsenceResponse> {
    return this.absencesService.cancelAbsence(req.user.sub, id);
  }

  /**
   * GET /absences
   * Get all company absences (admin only)
   */
  @Get()
  @UseGuards(AdminGuard)
  async getAllAbsences(
    @Req() req: RequestWithUser,
    @Query('status') status?: AbsenceStatus,
    @Query('userId') userId?: string,
  ): Promise<AbsenceResponse[]> {
    return this.absencesService.getAllAbsences(
      req.user.companyId,
      status,
      userId,
    );
  }

  /**
   * GET /absences/:id
   * Get a single absence by ID (admin only)
   */
  @Get(':id')
  @UseGuards(AdminGuard)
  async getAbsence(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<AbsenceResponse> {
    return this.absencesService.getAbsenceById(id, req.user.companyId);
  }

  /**
   * PATCH /absences/:id/review
   * Approve or reject an absence request (admin only)
   */
  @Patch(':id/review')
  @UseGuards(AdminGuard)
  async reviewAbsence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAbsenceDto,
    @Req() req: RequestWithUser,
  ): Promise<AbsenceResponse> {
    return this.absencesService.reviewAbsence(
      id,
      req.user.sub,
      req.user.companyId,
      dto,
    );
  }
}
