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
import type { Request } from 'express';
import { CheckUserAccess } from '../auth/decorators/check-user-access.decorator.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotGuestGuard } from '../auth/not-guest.guard.js';
import { TeamLeaderGuard } from '../auth/team-leader.guard.js';
import { TeamScopeService } from '../auth/team-scope.service.js';
import { UserAccessGuard } from '../auth/user-access.guard.js';
import { AdminCreateTimeEntryDto } from './dto/admin-create-time-entry.dto.js';
import { AdminGetTimeEntriesQueryDto } from './dto/admin-get-time-entries-query.dto.js';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto.js';
import { GetTimeEntriesByDateQueryDto } from './dto/get-time-entries-by-date-query.dto.js';
import { GetTimeEntriesQueryDto } from './dto/get-time-entries-query.dto.js';
import { StartTimerDto } from './dto/start-timer.dto.js';
import { SwitchTimerDto } from './dto/switch-timer.dto.js';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto.js';
import {
  ActiveTimerResponse,
  DeletedTimeEntryResponse,
  SwitchTimerResponse,
  TimeEntriesService,
  TimeEntryResponse,
  type EnumOption,
} from './time-entries.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('time-entries')
@UseGuards(JwtAuthGuard, UserAccessGuard)
export class TimeEntriesController {
  constructor(
    private readonly timeEntriesService: TimeEntriesService,
    private readonly teamScopeService: TeamScopeService,
  ) {}

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

  @Get('me/by-date')
  findMyEntriesByDate(
    @Query() query: GetTimeEntriesByDateQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse[]> {
    return this.timeEntriesService.findMyEntriesByDate(
      req.user.sub,
      req.user.companyId,
      query.date,
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
  // ADMIN/TEAM LEADER ROUTES (/time-entries/*)
  // Protected by TeamLeaderGuard
  // ============================================

  @Get()
  @UseGuards(TeamLeaderGuard)
  async findAll(
    @Query() query: AdminGetTimeEntriesQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse[]> {
    const userIds = await this.teamScopeService.getUserIdsInScope(req.user);
    return this.timeEntriesService.findAll(req.user.companyId, {
      userId: query.userId,
      userIds,
      year: query.year,
      month: query.month,
    });
  }

  @Post()
  @UseGuards(TeamLeaderGuard)
  @CheckUserAccess({ source: 'body' })
  async adminCreate(
    @Body() dto: AdminCreateTimeEntryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    return this.timeEntriesService.adminCreate(dto, req.user.companyId);
  }

  @Get(':id')
  @UseGuards(TeamLeaderGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    const entry = await this.timeEntriesService.findOne(id, req.user.companyId);
    // Check if user has access to this time entry's user
    const canAccess = await this.teamScopeService.canAccessUser(
      req.user,
      entry.userId,
    );
    if (!canAccess) {
      throw new ForbiddenException(
        'No tienes acceso a este registro de tiempo',
      );
    }
    return entry;
  }

  @Patch(':id')
  @UseGuards(TeamLeaderGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
    @Req() req: RequestWithUser,
  ): Promise<TimeEntryResponse> {
    // First get the entry to check permissions
    const entry = await this.timeEntriesService.findOne(id, req.user.companyId);
    // Check if user has access to this time entry's user
    const canAccess = await this.teamScopeService.canAccessUser(
      req.user,
      entry.userId,
    );
    if (!canAccess) {
      throw new ForbiddenException(
        'No tienes acceso para editar este registro de tiempo',
      );
    }
    return this.timeEntriesService.update(
      id,
      updateTimeEntryDto,
      req.user.companyId,
    );
  }

  @Delete(':id')
  @UseGuards(TeamLeaderGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<DeletedTimeEntryResponse> {
    // First get the entry to check permissions
    const entry = await this.timeEntriesService.findOne(id, req.user.companyId);
    // Check if user has access to this time entry's user
    const canAccess = await this.teamScopeService.canAccessUser(
      req.user,
      entry.userId,
    );
    if (!canAccess) {
      throw new ForbiddenException(
        'No tienes acceso para eliminar este registro de tiempo',
      );
    }
    return this.timeEntriesService.remove(id, req.user.companyId);
  }
}
