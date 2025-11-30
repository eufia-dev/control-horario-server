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
import { CreateTimeEntryDto } from './dto/create-time-entry.dto.js';
import { AdminCreateTimeEntryDto } from './dto/admin-create-time-entry.dto.js';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto.js';
import { StartTimerDto } from './dto/start-timer.dto.js';
import { SwitchTimerDto } from './dto/switch-timer.dto.js';
import {
  DeletedTimeEntryResponse,
  TimeEntryResponse,
  ActiveTimerResponse,
  SwitchTimerResponse,
  TimeEntryTypeResponse,
  TimeEntriesService,
} from './time-entries.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('time-entries')
@UseGuards(JwtAuthGuard)
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  // ============================================
  // USER ROUTES (/time-entries/me/*)
  // These are defined FIRST to avoid route conflicts
  // ============================================

  @Get('me')
  findMyEntries(@Req() req: RequestWithUser): Promise<TimeEntryResponse[]> {
    return this.timeEntriesService.findMyEntries(
      req.user.sub,
      req.user.organizationId,
    );
  }

  @Post('me')
  create(
    @Body() createTimeEntryDto: CreateTimeEntryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.create(
      createTimeEntryDto,
      req.user.sub,
      req.user.organizationId,
    );
  }

  @Get('me/timer')
  getActiveTimer(
    @Req() req: RequestWithUser,
  ): Promise<ActiveTimerResponse | null> {
    return this.timeEntriesService.getActiveTimer(
      req.user.sub,
      req.user.organizationId,
    );
  }

  @Get('me/:id')
  findMyOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.findMyOne(
      id,
      req.user.sub,
      req.user.organizationId,
    );
  }

  @Patch('me/:id')
  updateMine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.updateMine(
      id,
      updateTimeEntryDto,
      req.user.sub,
      req.user.organizationId,
    );
  }

  @Delete('me/:id')
  removeMine(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<DeletedTimeEntryResponse> {
    return this.timeEntriesService.removeMine(
      id,
      req.user.sub,
      req.user.organizationId,
    );
  }

  // ============================================
  // TIMER ROUTES (/time-entries/me/timer/*)
  // For starting, stopping, and switching active timers
  // ============================================

  @Post('me/timer/start')
  startTimer(
    @Body() dto: StartTimerDto,
    @Req() req: RequestWithUser,
  ): Promise<ActiveTimerResponse> {
    return this.timeEntriesService.startTimer(
      dto,
      req.user.sub,
      req.user.organizationId,
    );
  }

  @Post('me/timer/stop')
  stopTimer(@Req() req: RequestWithUser): Promise<TimeEntryResponse> {
    return this.timeEntriesService.stopTimer(
      req.user.sub,
      req.user.organizationId,
    );
  }

  @Post('me/timer/switch')
  switchTimer(
    @Body() dto: SwitchTimerDto,
    @Req() req: RequestWithUser,
  ): Promise<SwitchTimerResponse> {
    return this.timeEntriesService.switchTimer(
      dto,
      req.user.sub,
      req.user.organizationId,
    );
  }

  @Delete('me/timer')
  cancelTimer(@Req() req: RequestWithUser): Promise<ActiveTimerResponse> {
    return this.timeEntriesService.cancelTimer(
      req.user.sub,
      req.user.organizationId,
    );
  }

  // ============================================
  // TIME ENTRY TYPES (/time-entries/types)
  // Available to all authenticated users
  // ============================================

  @Get('types')
  findAllTypes(): Promise<TimeEntryTypeResponse[]> {
    return this.timeEntriesService.findAllTypes();
  }

  // ============================================
  // ADMIN ROUTES (/time-entries/*)
  // Protected by AdminGuard
  // ============================================

  @Get()
  @UseGuards(AdminGuard)
  findAll(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
  ): Promise<TimeEntryResponse[]> {
    return this.timeEntriesService.findAll(req.user.organizationId, userId);
  }

  @Post()
  @UseGuards(AdminGuard)
  adminCreate(
    @Body() dto: AdminCreateTimeEntryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.adminCreate(dto, req.user.organizationId);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.findOne(id, req.user.organizationId);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.update(
      id,
      updateTimeEntryDto,
      req.user.organizationId,
    );
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<DeletedTimeEntryResponse> {
    return this.timeEntriesService.remove(id, req.user.organizationId);
  }
}
