import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CalendarService } from './calendar.service.js';
import type { CalendarResponse } from './dto/calendar-day.dto.js';
import { CalendarQueryDto } from './dto/calendar-query.dto.js';

type RequestWithUser = Request & { user: JwtPayload };

function parseLocalDateOnly(dateStr: string): Date {
  // Avoid JS Date parsing quirks/timezone shifts for "YYYY-MM-DD" (often treated as UTC).
  const [y, m, d] = dateStr.split('-').map((v) => Number(v));
  return new Date(y, m - 1, d);
}

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  /**
   * GET /calendar?from=2025-01-01&to=2025-01-31&userId=xxx
   * Get calendar with computed day statuses
   * If userId is not provided, returns calendar for current user
   */
  @Get()
  async getCalendar(
    @Query() query: CalendarQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<CalendarResponse> {
    const userId = query.userId || req.user.sub;
    const from = parseLocalDateOnly(query.from);
    const to = parseLocalDateOnly(query.to);

    // Set time to start/end of day
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    return this.calendarService.getCalendar(
      req.user.companyId,
      userId,
      from,
      to,
    );
  }

  /**
   * GET /calendar/me?from=2025-01-01&to=2025-01-31
   * Shortcut to get current user's calendar
   */
  @Get('me')
  async getMyCalendar(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: RequestWithUser,
  ): Promise<CalendarResponse> {
    const fromDate = parseLocalDateOnly(from);
    const toDate = parseLocalDateOnly(to);

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    return this.calendarService.getCalendar(
      req.user.companyId,
      req.user.sub,
      fromDate,
      toDate,
    );
  }
}
