import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NagerDateService } from './nager-date.service.js';
import type { CreateCompanyHolidayDto } from './dto/create-company-holiday.dto.js';
import type {
  PublicHoliday,
  CompanyHoliday,
  HolidaySource,
} from '@prisma/client';

export interface HolidayResponse {
  id: string;
  date: Date;
  name: string;
  localName: string | null;
  type: 'public' | 'company';
  isNational: boolean;
  regionCode: string | null;
  source?: HolidaySource;
}

export interface CompanyHolidayResponse {
  id: string;
  date: Date;
  name: string;
  isRecurring: boolean;
  createdAt: Date;
}

export interface SyncResult {
  year: number;
  holidaysAdded: number;
  holidaysUpdated: number;
}

@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nagerDateService: NagerDateService,
  ) {}

  /**
   * Sync holidays from Nager.Date API for a company's region
   * This upserts holidays to avoid duplicates
   */
  async syncHolidaysForCompany(
    companyId: string,
    regionCode: string,
    years: number[],
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const year of years) {
      const result = await this.syncHolidaysForYear(regionCode, year);
      results.push(result);
    }

    this.logger.log(
      `Synced holidays for company ${companyId}, region ${regionCode}: ${JSON.stringify(results)}`,
    );

    return results;
  }

  /**
   * Sync holidays for a specific year and region
   */
  private async syncHolidaysForYear(
    regionCode: string,
    year: number,
  ): Promise<SyncResult> {
    const holidays = await this.nagerDateService.fetchHolidaysForRegion(
      year,
      regionCode,
    );

    let added = 0;
    let updated = 0;

    for (const holiday of holidays) {
      const date = new Date(holiday.date);
      const isNational =
        holiday.global || !holiday.counties || holiday.counties.length === 0;
      const effectiveRegionCode = isNational ? null : regionCode;

      try {
        if (isNational) {
          const existingNational = await this.prisma.publicHoliday.findFirst({
            where: {
              date,
              country: 'ES',
              regionCode: null,
            },
          });

          if (existingNational) {
            await this.prisma.publicHoliday.update({
              where: { id: existingNational.id },
              data: {
                name: holiday.name,
                localName: holiday.localName,
                isFixed: holiday.fixed,
                year,
                source: 'API',
              },
            });
            updated++;
          } else {
            await this.prisma.publicHoliday.create({
              data: {
                date,
                name: holiday.name,
                localName: holiday.localName,
                country: 'ES',
                regionCode: null,
                year,
                isFixed: holiday.fixed,
                source: 'API',
              },
            });
            added++;
          }
        } else {
          await this.prisma.publicHoliday.upsert({
            where: {
              date_country_regionCode: {
                date,
                country: 'ES',
                regionCode: effectiveRegionCode as string,
              },
            },
            create: {
              date,
              name: holiday.name,
              localName: holiday.localName,
              country: 'ES',
              regionCode: effectiveRegionCode,
              year,
              isFixed: holiday.fixed,
              source: 'API',
            },
            update: {
              name: holiday.name,
              localName: holiday.localName,
              isFixed: holiday.fixed,
            },
          });
          added++;
        }
      } catch (error) {
        this.logger.warn(`Error upserting holiday ${holiday.date}: ${error}`);
      }
    }

    return { year, holidaysAdded: added, holidaysUpdated: updated };
  }

  /**
   * Get all holidays for a company (public + custom) for a specific year
   */
  async getHolidaysForCompany(
    companyId: string,
    year: number,
  ): Promise<HolidayResponse[]> {
    // Get company location to know the region
    const location = await this.prisma.companyLocation.findUnique({
      where: { companyId },
    });

    if (!location) {
      throw new NotFoundException('Ubicación de la empresa no encontrada');
    }

    // Get public holidays (national + regional)
    const publicHolidays = await this.prisma.publicHoliday.findMany({
      where: {
        year,
        country: 'ES',
        OR: [
          { regionCode: null }, // National holidays
          { regionCode: location.regionCode }, // Regional holidays
        ],
      },
      orderBy: { date: 'asc' },
    });

    // Get company custom holidays for the year
    const companyHolidays = await this.prisma.companyHoliday.findMany({
      where: {
        companyId,
        OR: [
          {
            date: {
              gte: new Date(`${year}-01-01`),
              lte: new Date(`${year}-12-31`),
            },
          },
          { isRecurring: true },
        ],
      },
      orderBy: { date: 'asc' },
    });

    // Combine and format
    const holidays: HolidayResponse[] = [
      ...publicHolidays.map((h) => ({
        id: h.id,
        date: h.date,
        name: h.localName || h.name,
        localName: h.localName,
        type: 'public' as const,
        isNational: h.regionCode === null,
        regionCode: h.regionCode,
        source: h.source,
      })),
      ...companyHolidays.map((h) => ({
        id: h.id,
        date: h.date,
        name: h.name,
        localName: null,
        type: 'company' as const,
        isNational: false,
        regionCode: null,
      })),
    ];

    // Sort by date
    holidays.sort((a, b) => a.date.getTime() - b.date.getTime());

    return holidays;
  }

  /**
   * Get public holidays for a specific date range and region
   */
  async getPublicHolidaysInRange(
    regionCode: string,
    from: Date,
    to: Date,
  ): Promise<PublicHoliday[]> {
    return this.prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
        country: 'ES',
        OR: [
          { regionCode: null }, // National
          { regionCode }, // Regional
        ],
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Get company custom holidays for a specific date range
   */
  async getCompanyHolidaysInRange(
    companyId: string,
    from: Date,
    to: Date,
  ): Promise<CompanyHoliday[]> {
    return this.prisma.companyHoliday.findMany({
      where: {
        companyId,
        OR: [
          {
            date: {
              gte: from,
              lte: to,
            },
          },
          { isRecurring: true },
        ],
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Check if a specific date is a holiday for a company
   */
  async isHoliday(companyId: string, date: Date): Promise<boolean> {
    const location = await this.prisma.companyLocation.findUnique({
      where: { companyId },
    });

    if (!location) {
      return false;
    }

    // Check public holidays
    const publicHoliday = await this.prisma.publicHoliday.findFirst({
      where: {
        date,
        country: 'ES',
        OR: [{ regionCode: null }, { regionCode: location.regionCode }],
      },
    });

    if (publicHoliday) {
      return true;
    }

    // Check company holidays
    const companyHoliday = await this.prisma.companyHoliday.findFirst({
      where: {
        companyId,
        OR: [
          { date },
          {
            isRecurring: true,
            date: {
              // Match day and month regardless of year
              gte: new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
              ),
              lt: new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate() + 1,
              ),
            },
          },
        ],
      },
    });

    return !!companyHoliday;
  }

  /**
   * Create a custom company holiday
   */
  async createCompanyHoliday(
    companyId: string,
    dto: CreateCompanyHolidayDto,
  ): Promise<CompanyHolidayResponse> {
    const date = new Date(dto.date);

    // Check if holiday already exists for this date
    const existing = await this.prisma.companyHoliday.findUnique({
      where: {
        companyId_date: {
          companyId,
          date,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un día festivo de empresa para esta fecha',
      );
    }

    const holiday = await this.prisma.companyHoliday.create({
      data: {
        companyId,
        date,
        name: dto.name,
        isRecurring: dto.isRecurring ?? false,
      },
    });

    return this.toCompanyHolidayResponse(holiday);
  }

  /**
   * Delete a custom company holiday
   */
  async deleteCompanyHoliday(
    companyId: string,
    holidayId: string,
  ): Promise<CompanyHolidayResponse> {
    const holiday = await this.prisma.companyHoliday.findFirst({
      where: {
        id: holidayId,
        companyId,
      },
    });

    if (!holiday) {
      throw new NotFoundException('Día festivo no encontrado');
    }

    await this.prisma.companyHoliday.delete({
      where: { id: holidayId },
    });

    return this.toCompanyHolidayResponse(holiday);
  }

  /**
   * Get all custom company holidays
   */
  async getCompanyHolidays(
    companyId: string,
  ): Promise<CompanyHolidayResponse[]> {
    const holidays = await this.prisma.companyHoliday.findMany({
      where: { companyId },
      orderBy: { date: 'asc' },
    });

    return holidays.map((h) => this.toCompanyHolidayResponse(h));
  }

  private toCompanyHolidayResponse(
    holiday: CompanyHoliday,
  ): CompanyHolidayResponse {
    return {
      id: holiday.id,
      date: holiday.date,
      name: holiday.name,
      isRecurring: holiday.isRecurring,
      createdAt: holiday.createdAt,
    };
  }
}
