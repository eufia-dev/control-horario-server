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
import { NotGuestGuard } from '../auth/not-guest.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto.js';
import { AdminCreateTimeEntryDto } from './dto/admin-create-time-entry.dto.js';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto.js';
import { StartTimerDto } from './dto/start-timer.dto.js';
import { SwitchTimerDto } from './dto/switch-timer.dto.js';
import { GetTimeEntriesQueryDto } from './dto/get-time-entries-query.dto.js';
import { AdminGetTimeEntriesQueryDto } from './dto/admin-get-time-entries-query.dto.js';
import {
  DeletedTimeEntryResponse,
  TimeEntryResponse,
  ActiveTimerResponse,
  SwitchTimerResponse,
  TimeEntriesService,
  type EnumOption,
} from './time-entries.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('time-entries')
@UseGuards(JwtAuthGuard)
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  // ============================================
  // TYPES (enum values for frontend)
  // ============================================

  @Get('types')
  getTypes(): EnumOption[] {
    return this.timeEntriesService.getTypes();
  }

  // ============================================
  // USER ROUTES (/time-entries/me/*)
  // These are defined FIRST to avoid route conflicts
  // ============================================

  @Get('me')
  findMyEntries(
    @Query() query: GetTimeEntriesQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse[]> {
    return this.timeEntriesService.findMyEntries(
      req.user.sub,
      req.user.companyId,
      query.year,
      query.month,
    );
  }

  @Post('me')
  @UseGuards(NotGuestGuard)
  create(
    @Body() createTimeEntryDto: CreateTimeEntryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.create(
      createTimeEntryDto,
      req.user.sub,
      req.user.companyId,
    );
  }

  @Get('me/timer')
  getActiveTimer(
    @Req() req: RequestWithUser,
  ): Promise<ActiveTimerResponse | null> {
    return this.timeEntriesService.getActiveTimer(
      req.user.sub,
      req.user.companyId,
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
      req.user.companyId,
    );
  }

  @Patch('me/:id')
  @UseGuards(NotGuestGuard)
  updateMine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.updateMine(
      id,
      updateTimeEntryDto,
      req.user.sub,
      req.user.companyId,
    );
  }

  @Delete('me/:id')
  @UseGuards(NotGuestGuard)
  removeMine(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<DeletedTimeEntryResponse> {
    return this.timeEntriesService.removeMine(
      id,
      req.user.sub,
      req.user.companyId,
    );
  }

  // ============================================
  // TIMER ROUTES (/time-entries/me/timer/*)
  // For starting, stopping, and switching active timers
  // ============================================

  @Post('me/timer/start')
  @UseGuards(NotGuestGuard)
  startTimer(
    @Body() dto: StartTimerDto,
    @Req() req: RequestWithUser,
  ): Promise<ActiveTimerResponse> {
    return this.timeEntriesService.startTimer(
      dto,
      req.user.sub,
      req.user.companyId,
    );
  }

  @Post('me/timer/stop')
  @UseGuards(NotGuestGuard)
  stopTimer(@Req() req: RequestWithUser): Promise<TimeEntryResponse> {
    return this.timeEntriesService.stopTimer(req.user.sub, req.user.companyId);
  }

  @Post('me/timer/switch')
  @UseGuards(NotGuestGuard)
  switchTimer(
    @Body() dto: SwitchTimerDto,
    @Req() req: RequestWithUser,
  ): Promise<SwitchTimerResponse> {
    return this.timeEntriesService.switchTimer(
      dto,
      req.user.sub,
      req.user.companyId,
    );
  }

  @Delete('me/timer')
  @UseGuards(NotGuestGuard)
  cancelTimer(@Req() req: RequestWithUser): Promise<ActiveTimerResponse> {
    return this.timeEntriesService.cancelTimer(
      req.user.sub,
      req.user.companyId,
    );
  }

  // ============================================
  // ADMIN ROUTES (/time-entries/*)
  // Protected by AdminGuard
  // ============================================

  @Get()
  @UseGuards(AdminGuard)
  findAll(
    @Query() query: AdminGetTimeEntriesQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse[]> {
    return this.timeEntriesService.findAll(
      req.user.companyId,
      query.userId,
      query.year,
      query.month,
    );
  }

  @Post()
  @UseGuards(AdminGuard)
  adminCreate(
    @Body() dto: AdminCreateTimeEntryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.adminCreate(dto, req.user.companyId);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.findOne(id, req.user.companyId);
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
      req.user.companyId,
    );
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<DeletedTimeEntryResponse> {
    return this.timeEntriesService.remove(id, req.user.companyId);
  }
}
