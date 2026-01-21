import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TeamLeaderGuard } from '../auth/team-leader.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CashFlowFeatureGuard } from '../auth/cash-flow-feature.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateProviderDto, UpdateProviderDto } from './dto/index.js';
import {
  ProvidersService,
  type ProviderResponse,
} from './providers.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('providers')
@UseGuards(JwtAuthGuard, CashFlowFeatureGuard, TeamLeaderGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  findAll(@Req() req: RequestWithUser): Promise<ProviderResponse[]> {
    return this.providersService.findAll(req.user.companyId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<ProviderResponse> {
    return this.providersService.findOne(id, req.user.companyId);
  }

  @Post()
  create(
    @Body() dto: CreateProviderDto,
    @Req() req: RequestWithUser,
  ): Promise<ProviderResponse> {
    return this.providersService.create(dto, req.user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProviderDto,
    @Req() req: RequestWithUser,
  ): Promise<ProviderResponse> {
    return this.providersService.update(id, dto, req.user.companyId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean }> {
    return this.providersService.remove(id, req.user.companyId);
  }
}
