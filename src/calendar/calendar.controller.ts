import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CalendarService } from './calendar.service.js';
import type { CalendarResponse } from './dto/calendar-day.dto.js';
import { CalendarQueryDto } from './dto/calendar-query.dto.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
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
}
