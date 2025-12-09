import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import {
  JoinRequestsService,
  type JoinRequestResponse,
  type JoinRequestWithUser,
  type ApproveOptionsResponse,
} from './join-requests.service.js';
import { ApproveRequestDto } from './dto/index.js';
import type { JoinRequestStatus } from '@prisma/client';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('join-requests')
@UseGuards(JwtAuthGuard, AdminGuard)
export class JoinRequestsController {
  constructor(private readonly joinRequestsService: JoinRequestsService) {}

  @Get('options')
  getOptions(): ApproveOptionsResponse {
    return this.joinRequestsService.getOptions();
  }

  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query('status') status?: JoinRequestStatus,
  ): Promise<JoinRequestResponse[]> {
    return this.joinRequestsService.findAll(req.user.companyId, status);
  }

  @Get('pending-count')
  async getPendingCount(
    @Req() req: RequestWithUser,
  ): Promise<{ count: number }> {
    const count = await this.joinRequestsService.getPendingCount(
      req.user.companyId,
    );
    return { count };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<JoinRequestResponse> {
    return this.joinRequestsService.findOne(id, req.user.companyId);
  }

  @Post(':id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: ApproveRequestDto,
  ): Promise<JoinRequestWithUser> {
    return this.joinRequestsService.approve(
      id,
      req.user.companyId,
      req.user.sub,
      dto,
    );
  }

  @Post(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<JoinRequestResponse> {
    return this.joinRequestsService.reject(
      id,
      req.user.companyId,
      req.user.sub,
    );
  }
}
