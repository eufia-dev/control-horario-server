import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateCompanyHolidayDto } from './dto/create-company-holiday.dto.js';
import { SPAIN_REGIONS, type SpainRegion } from './dto/spain-regions.js';
import {
  HolidaysService,
  type HolidayResponse,
  type CompanyHolidayResponse,
} from './holidays.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('holidays')
@UseGuards(JwtAuthGuard)
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  /**
   * GET /holidays/regions
   * Get list of Spanish regions for dropdown selection
   */
  @Get('regions')
  getRegions(): SpainRegion[] {
    return SPAIN_REGIONS;
  }

  /**
   * GET /holidays?year=2025
   * Get all holidays for the company (public + custom) for a specific year
   */
  @Get()
  async getHolidays(
    @Query('year', ParseIntPipe) year: number,
    @Req() req: RequestWithUser,
  ): Promise<HolidayResponse[]> {
    return this.holidaysService.getHolidaysForCompany(req.user.companyId, year);
  }

  /**
   * GET /holidays/company
   * Get only custom company holidays
   */
  @Get('company')
  async getCompanyHolidays(
    @Req() req: RequestWithUser,
  ): Promise<CompanyHolidayResponse[]> {
    return this.holidaysService.getCompanyHolidays(req.user.companyId);
  }

  /**
   * POST /holidays
   * Add a custom company holiday (admin only)
   */
  @Post()
  @UseGuards(AdminGuard)
  async createCompanyHoliday(
    @Body() dto: CreateCompanyHolidayDto,
    @Req() req: RequestWithUser,
  ): Promise<CompanyHolidayResponse> {
    return this.holidaysService.createCompanyHoliday(req.user.companyId, dto);
  }

  /**
   * DELETE /holidays/:id
   * Remove a custom company holiday (admin only)
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteCompanyHoliday(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<CompanyHolidayResponse> {
    return this.holidaysService.deleteCompanyHoliday(req.user.companyId, id);
  }

  /**
   * POST /holidays/sync
   * Manually trigger holiday sync from Nager.Date API (admin only)
   */
  @Post('sync')
  @UseGuards(AdminGuard)
  async syncHolidays(
    @Query('year', ParseIntPipe) year: number,
    @Req() req: RequestWithUser,
  ) {
    // Get company location
    const location = await this.holidaysService[
      'prisma'
    ].companyLocation.findUnique({
      where: { companyId: req.user.companyId },
    });

    if (!location) {
      return { error: 'Company location not found' };
    }

    const results = await this.holidaysService.syncHolidaysForCompany(
      req.user.companyId,
      location.regionCode,
      [year],
    );

    return { success: true, results };
  }
}
