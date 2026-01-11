import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CheckUserAccess } from '../auth/decorators/check-user-access.decorator.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TeamLeaderGuard } from '../auth/team-leader.guard.js';
import { UserAccessGuard } from '../auth/user-access.guard.js';
import { CalendarService } from './calendar.service.js';
import type {
  CalendarMonthResponse,
  CalendarResponse,
} from './dto/calendar-day.dto.js';
import {
  AdminCalendarMonthQueryDto,
  CalendarMonthQueryDto,
} from './dto/calendar-month-query.dto.js';
import { CalendarQueryDto } from './dto/calendar-query.dto.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('calendar')
@UseGuards(JwtAuthGuard, UserAccessGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @UseGuards(TeamLeaderGuard)
  @CheckUserAccess({ paramName: 'userId', source: 'query' })
  async getCalendar(
    @Query() query: CalendarQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<CalendarResponse> {
    return this.calendarService.getCalendar(
      req.user.companyId,
      query.userId,
      query.from,
      query.to,
    );
  }

  @Get('me')
  async getMyCalendar(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: RequestWithUser,
  ): Promise<CalendarResponse> {
    return this.calendarService.getCalendar(
      req.user.companyId,
      req.user.sub,
      from,
      to,
    );
  }

  // ============================================
  // MONTH-BASED ROUTES
  // ============================================

  @Get('me/month')
  getMyCalendarByMonth(
    @Query() query: CalendarMonthQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<CalendarMonthResponse> {
    return this.calendarService.getCalendarByMonth(
      req.user.companyId,
      req.user.sub,
      query.year,
      query.month,
    );
  }

  @Get('month')
  @UseGuards(TeamLeaderGuard)
  @CheckUserAccess({ paramName: 'userId', source: 'query' })
  async getCalendarByMonth(
    @Query() query: AdminCalendarMonthQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<CalendarMonthResponse> {
    return this.calendarService.getCalendarByMonth(
      req.user.companyId,
      query.userId,
      query.year,
      query.month,
    );
  }
}
