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
import { CreateExternalHoursDto } from './dto/create-external-hours.dto.js';
import { UpdateExternalDto } from './dto/update-external.dto.js';
import { UpdateExternalHoursDto } from './dto/update-external-hours.dto.js';
import {
  DeletedExternalHoursResponse,
  DeletedExternalWorkerResponse,
  ExternalHoursResponse,
  ExternalWorkerResponse,
  ExternalsService,
} from './externals.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('externals')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ExternalsController {
  constructor(private readonly externalsService: ExternalsService) {}

  @Get()
  findAll(@Req() req: RequestWithUser): Promise<ExternalWorkerResponse[]> {
    return this.externalsService.findAll(req.user.companyId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<ExternalWorkerResponse> {
    return this.externalsService.findOne(id, req.user.companyId);
  }

  @Post()
  create(
    @Body() createExternalDto: CreateExternalDto,
    @Req() req: RequestWithUser,
  ): Promise<ExternalWorkerResponse> {
    return this.externalsService.create(createExternalDto, req.user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExternalDto: UpdateExternalDto,
    @Req() req: RequestWithUser,
  ): Promise<ExternalWorkerResponse> {
    return this.externalsService.update(
      id,
      updateExternalDto,
      req.user.companyId,
    );
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<DeletedExternalWorkerResponse> {
    return this.externalsService.remove(id, req.user.companyId);
  }

  // External Hours endpoints

  @Get(':externalId/hours')
  findAllHours(
    @Param('externalId', ParseUUIDPipe) externalId: string,
    @Req() req: RequestWithUser,
  ): Promise<ExternalHoursResponse[]> {
    return this.externalsService.findAllHours(externalId, req.user.companyId);
  }

  @Get(':externalId/hours/:hoursId')
  findOneHours(
    @Param('externalId', ParseUUIDPipe) externalId: string,
    @Param('hoursId', ParseUUIDPipe) hoursId: string,
    @Req() req: RequestWithUser,
  ): Promise<ExternalHoursResponse> {
    return this.externalsService.findOneHours(
      hoursId,
      externalId,
      req.user.companyId,
    );
  }

  @Post(':externalId/hours')
  createHours(
    @Param('externalId', ParseUUIDPipe) externalId: string,
    @Body() dto: CreateExternalHoursDto,
    @Req() req: RequestWithUser,
  ): Promise<ExternalHoursResponse> {
    return this.externalsService.createHours(
      externalId,
      dto,
      req.user.companyId,
    );
  }

  @Patch(':externalId/hours/:hoursId')
  updateHours(
    @Param('externalId', ParseUUIDPipe) externalId: string,
    @Param('hoursId', ParseUUIDPipe) hoursId: string,
    @Body() dto: UpdateExternalHoursDto,
    @Req() req: RequestWithUser,
  ): Promise<ExternalHoursResponse> {
    return this.externalsService.updateHours(
      hoursId,
      externalId,
      dto,
      req.user.companyId,
    );
  }

  @Delete(':externalId/hours/:hoursId')
  removeHours(
    @Param('externalId', ParseUUIDPipe) externalId: string,
    @Param('hoursId', ParseUUIDPipe) hoursId: string,
    @Req() req: RequestWithUser,
  ): Promise<DeletedExternalHoursResponse> {
    return this.externalsService.removeHours(
      hoursId,
      externalId,
      req.user.companyId,
    );
  }
}
