import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HolidaysService } from '../holidays/holidays.service.js';
import type { Company, BillingPlan, CompanyLocation } from '@prisma/client';
import type { UpdateLocationDto } from './dto/update-location.dto.js';
import { randomBytes } from 'crypto';

export interface CompanyResponse {
  id: string;
  name: string;
  cif: string | null;
  logoUrl: string | null;
  billingPlan: BillingPlan;
  allowUserEditSchedule: boolean;
  inviteCode: string | null;
  createdAt: Date;
}

export interface CompanyPublicResponse {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface LocationResponse {
  id: string;
  country: string;
  regionCode: string;
  provinceCode: string;
  municipalityName: string;
  address: string;
  postalCode: string;
  timezone: string;
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
  ) {}

  async findOne(id: string): Promise<CompanyResponse> {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
    }

    return this.toCompanyResponse(company);
  }

  /**
   * Search companies by name (public - returns limited info)
   */
  async search(query: string): Promise<CompanyPublicResponse[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const companies = await this.prisma.company.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 10,
      orderBy: { name: 'asc' },
    });

    return companies.map((c) => this.toPublicResponse(c));
  }

  /**
   * Find company by invite code (public - returns limited info)
   */
  async findByInviteCode(code: string): Promise<CompanyPublicResponse> {
    const company = await this.prisma.company.findUnique({
      where: { inviteCode: code.toUpperCase() },
    });

    if (!company) {
      throw new NotFoundException('Código de invitación no válido');
    }

    return this.toPublicResponse(company);
  }

  /**
   * Generate or regenerate invite code for a company
   */
  async generateInviteCode(companyId: string): Promise<{ inviteCode: string }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Generate a unique 8-character code
    let inviteCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      inviteCode = randomBytes(4).toString('hex').toUpperCase();
      const existing = await this.prisma.company.findUnique({
        where: { inviteCode },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new InternalServerErrorException(
        'No se pudo generar un código único para la empresa. Inténtalo de nuevo más tarde.',
      );
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { inviteCode },
    });

    return { inviteCode };
  }

  /**
   * Remove invite code from a company (disable public joining)
   */
  async removeInviteCode(companyId: string): Promise<void> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: { inviteCode: null },
    });
  }

  // ============================================
  // LOCATION METHODS
  // ============================================

  /**
   * Get company location
   */
  async getLocation(companyId: string): Promise<LocationResponse> {
    const location = await this.prisma.companyLocation.findUnique({
      where: { companyId },
    });

    if (!location) {
      throw new NotFoundException('Ubicación de la empresa no configurada');
    }

    return this.toLocationResponse(location);
  }

  /**
   * Update company location (triggers holiday re-sync if region changes)
   */
  async updateLocation(
    companyId: string,
    dto: UpdateLocationDto,
  ): Promise<LocationResponse> {
    // Check if location exists
    const existingLocation = await this.prisma.companyLocation.findUnique({
      where: { companyId },
    });

    const regionChanged =
      existingLocation && existingLocation.regionCode !== dto.regionCode;

    // Upsert location
    const location = await this.prisma.companyLocation.upsert({
      where: { companyId },
      create: {
        companyId,
        country: 'ES',
        regionCode: dto.regionCode,
        provinceCode: dto.provinceCode,
        municipalityName: dto.municipalityName,
        address: dto.address,
        postalCode: dto.postalCode,
      },
      update: {
        regionCode: dto.regionCode,
        provinceCode: dto.provinceCode,
        municipalityName: dto.municipalityName,
        address: dto.address,
        postalCode: dto.postalCode,
      },
    });

    // If region changed, sync holidays for the new region
    if (regionChanged || !existingLocation) {
      try {
        const currentYear = new Date().getFullYear();
        await this.holidaysService.syncHolidaysForCompany(
          companyId,
          dto.regionCode,
          [currentYear, currentYear + 1],
        );
        this.logger.log(
          `Holidays re-synced for company ${companyId} due to region change to ${dto.regionCode}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync holidays after location update: ${error}`,
        );
      }
    }

    return this.toLocationResponse(location);
  }

  private toLocationResponse(location: CompanyLocation): LocationResponse {
    return {
      id: location.id,
      country: location.country,
      regionCode: location.regionCode,
      provinceCode: location.provinceCode,
      municipalityName: location.municipalityName,
      address: location.address,
      postalCode: location.postalCode,
      timezone: location.timezone,
    };
  }

  private toCompanyResponse(company: Company): CompanyResponse {
    return {
      id: company.id,
      name: company.name,
      cif: company.cif,
      logoUrl: company.logoUrl,
      billingPlan: company.billingPlan,
      allowUserEditSchedule: company.allowUserEditSchedule,
      inviteCode: company.inviteCode,
      createdAt: company.createdAt,
    };
  }

  private toPublicResponse(company: Company): CompanyPublicResponse {
    return {
      id: company.id,
      name: company.name,
      logoUrl: company.logoUrl,
    };
  }
}
