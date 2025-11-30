import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CompanyResponse, CompaniesService } from './companies.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(@Req() req: RequestWithUser): Promise<CompanyResponse[]> {
    return this.companiesService.findAll(req.user.organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<CompanyResponse> {
    return this.companiesService.findOne(id, req.user.organizationId);
  }
}
