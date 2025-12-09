import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { SupportService } from './support.service.js';
import { BugReportDto, ContactMessageDto } from './dto/index.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('bug-report')
  async submitBugReport(
    @Req() req: RequestWithUser,
    @Body() dto: BugReportDto,
  ): Promise<{ message: string }> {
    return this.supportService.submitBugReport(req.user, dto);
  }

  @Post('contact')
  async submitContactMessage(
    @Req() req: RequestWithUser,
    @Body() dto: ContactMessageDto,
  ): Promise<{ message: string }> {
    return this.supportService.submitContactMessage(req.user, dto);
  }
}
