import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import {
  CompanyResponse,
  CompanyPublicResponse,
  LocationResponse,
  CompaniesService,
} from './companies.service.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /**
   * Search companies by name (public endpoint for onboarding)
   */
  @Get('search')
  search(@Query('q') query: string): Promise<CompanyPublicResponse[]> {
    return this.companiesService.search(query);
  }

  /**
   * Find company by invite code (public endpoint for onboarding)
   */
  @Get('by-code/:code')
  findByCode(@Param('code') code: string): Promise<CompanyPublicResponse> {
    return this.companiesService.findByInviteCode(code);
  }

  /**
   * Get the current user's company
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMyCompany(@Req() req: RequestWithUser): Promise<CompanyResponse> {
    return this.companiesService.findOne(req.user.companyId);
  }

  /**
   * Generate or regenerate invite code for the company
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('generate-invite-code')
  generateInviteCode(
    @Req() req: RequestWithUser,
  ): Promise<{ inviteCode: string }> {
    return this.companiesService.generateInviteCode(req.user.companyId);
  }

  /**
   * Remove invite code (disable public joining)
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('invite-code')
  async removeInviteCode(
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean }> {
    await this.companiesService.removeInviteCode(req.user.companyId);
    return { success: true };
  }

  // ============================================
  // LOCATION ENDPOINTS
  // ============================================

  /**
   * Get company location
   */
  @UseGuards(JwtAuthGuard)
  @Get('location')
  getLocation(@Req() req: RequestWithUser): Promise<LocationResponse> {
    return this.companiesService.getLocation(req.user.companyId);
  }

  /**
   * Update company location (admin only)
   * Triggers holiday re-sync if region changes
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('location')
  updateLocation(
    @Body() dto: UpdateLocationDto,
    @Req() req: RequestWithUser,
  ): Promise<LocationResponse> {
    return this.companiesService.updateLocation(req.user.companyId, dto);
  }
}
