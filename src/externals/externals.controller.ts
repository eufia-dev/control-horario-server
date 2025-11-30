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
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateExternalDto } from './dto/create-external.dto.js';
import { UpdateExternalDto } from './dto/update-external.dto.js';
import {
  DeletedExternalResponse,
  ExternalResponse,
  ExternalsService,
} from './externals.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('externals')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ExternalsController {
  constructor(private readonly externalsService: ExternalsService) {}

  @Get()
  findAll(@Req() req: RequestWithUser): Promise<ExternalResponse[]> {
    return this.externalsService.findAll(req.user.organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<ExternalResponse> {
    return this.externalsService.findOne(id, req.user.organizationId);
  }

  @Post()
  create(
    @Body() createExternalDto: CreateExternalDto,
    @Req() req: RequestWithUser,
  ): Promise<ExternalResponse> {
    return this.externalsService.create(
      createExternalDto,
      req.user.organizationId,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExternalDto: UpdateExternalDto,
    @Req() req: RequestWithUser,
  ): Promise<ExternalResponse> {
    return this.externalsService.update(
      id,
      updateExternalDto,
      req.user.organizationId,
    );
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<DeletedExternalResponse> {
    return this.externalsService.remove(id, req.user.organizationId);
  }
}
