import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OnboardingGuard } from '../auth/onboarding.guard.js';
import { LocationsService } from './locations.service.js';

@Controller('locations')
@UseGuards(OnboardingGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * GET /locations/municipalities?provinceCode=08
   * Returns municipality names for a given province code.
   * Auth: Supabase token required; onboarding completion not required.
   */
  @Get('municipalities')
  getMunicipalities(@Query('provinceCode') provinceCode: unknown): string[] {
    const code =
      typeof provinceCode === 'string' ? provinceCode.trim().toUpperCase() : '';

    if (!code) {
      throw new BadRequestException('provinceCode is required');
    }

    return this.locationsService.getMunicipalities(code);
  }
}
