import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { NotGuestGuard } from '../auth/not-guest.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { WorkSchedulesService } from './work-schedules.service.js';
import type { WorkScheduleResponse } from './dto/work-schedule-response.dto.js';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('work-schedules')
@UseGuards(JwtAuthGuard)
export class WorkSchedulesController {
  constructor(
    private readonly workSchedulesService: WorkSchedulesService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /work-schedules/company-default
   * Get company default schedule
   */
  @Get('company-default')
  async getCompanyDefault(
    @Req() req: RequestWithUser,
  ): Promise<WorkScheduleResponse> {
    return this.workSchedulesService.getCompanyDefault(req.user.companyId);
  }

  /**
   * GET /work-schedules/me
   * Get effective schedule for current user (defaults merged with overrides)
   */
  @Get('me')
  async getMySchedule(
    @Req() req: RequestWithUser,
  ): Promise<WorkScheduleResponse> {
    return this.workSchedulesService.getEffectiveSchedule(
      req.user.companyId,
      req.user.sub,
    );
  }

  /**
   * GET /work-schedules/users/:userId
   * Get effective schedule for a specific user (admin only)
   */
  @UseGuards(AdminGuard)
  @Get('users/:userId')
  async getUserSchedule(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: RequestWithUser,
  ): Promise<WorkScheduleResponse> {
    return this.workSchedulesService.getEffectiveSchedule(
      req.user.companyId,
      userId,
    );
  }

  /**
   * PUT /work-schedules/company-default
   * Update company default schedule (admin only)
   */
  @UseGuards(AdminGuard)
  @Put('company-default')
  async updateCompanyDefault(
    @Body() dto: UpdateWorkScheduleDto,
    @Req() req: RequestWithUser,
  ): Promise<WorkScheduleResponse> {
    return this.workSchedulesService.updateCompanyDefault(
      req.user.companyId,
      dto,
    );
  }

  /**
   * PUT /work-schedules/me
   * Update current user's schedule overrides
   * Requires Company.allowUserEditSchedule = true
   */
  @Put('me')
  @UseGuards(NotGuestGuard)
  async updateMySchedule(
    @Body() dto: UpdateWorkScheduleDto,
    @Req() req: RequestWithUser,
  ): Promise<WorkScheduleResponse> {
    // Check if user is allowed to edit schedule
    const company = await this.prisma.company.findUnique({
      where: { id: req.user.companyId },
      select: { allowUserEditSchedule: true },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    return this.workSchedulesService.updateUserOverrides(
      req.user.companyId,
      req.user.sub,
      dto,
      company.allowUserEditSchedule,
    );
  }

  /**
   * DELETE /work-schedules/me/overrides
   * Delete all current user's schedule overrides
   * Requires Company.allowUserEditSchedule = true
   */
  @Delete('me/overrides')
  @UseGuards(NotGuestGuard)
  async deleteMyOverrides(@Req() req: RequestWithUser): Promise<void> {
    // Check if user is allowed to edit schedule
    const company = await this.prisma.company.findUnique({
      where: { id: req.user.companyId },
      select: { allowUserEditSchedule: true },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    return this.workSchedulesService.deleteUserOverrides(
      req.user.companyId,
      req.user.sub,
      company.allowUserEditSchedule,
    );
  }

  /**
   * PUT /work-schedules/users/:userId
   * Update a specific user's schedule overrides (admin only)
   */
  @UseGuards(AdminGuard)
  @Put('users/:userId')
  async updateUserSchedule(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateWorkScheduleDto,
    @Req() req: RequestWithUser,
  ): Promise<WorkScheduleResponse> {
    return this.workSchedulesService.updateUserOverridesByAdmin(
      req.user.companyId,
      userId,
      dto,
    );
  }

  /**
   * DELETE /work-schedules/users/:userId/overrides
   * Delete all schedule overrides for a specific user (admin only)
   */
  @UseGuards(AdminGuard)
  @Delete('users/:userId/overrides')
  async deleteUserOverrides(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.workSchedulesService.deleteUserOverridesByAdmin(
      req.user.companyId,
      userId,
    );
  }
}
