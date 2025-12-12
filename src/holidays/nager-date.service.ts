import { Injectable, Logger } from '@nestjs/common';

export interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

@Injectable()
export class NagerDateService {
  private readonly logger = new Logger(NagerDateService.name);
  private readonly baseUrl = 'https://date.nager.at/api/v3';

  /**
   * Fetch public holidays for a country and year from Nager.Date API
   */
  async fetchHolidays(
    year: number,
    countryCode: string = 'ES',
  ): Promise<NagerHoliday[]> {
    const url = `${this.baseUrl}/publicholidays/${year}/${countryCode}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.error(
          `Failed to fetch holidays: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      const holidays = (await response.json()) as NagerHoliday[];
      this.logger.log(
        `Fetched ${holidays.length} holidays for ${countryCode} ${year}`,
      );
      return holidays;
    } catch (error) {
      this.logger.error(`Error fetching holidays from Nager.Date: ${error}`);
      return [];
    }
  }

  /**
   * Filter holidays that apply to a specific region
   * A holiday applies if it's global OR if the region is in the counties array
   */
  filterHolidaysByRegion(
    holidays: NagerHoliday[],
    regionCode: string,
  ): NagerHoliday[] {
    return holidays.filter((holiday) => {
      // Holidays with no counties or marked as global apply to all regions
      if (
        holiday.global ||
        !holiday.counties ||
        holiday.counties.length === 0
      ) {
        return true;
      }

      // Regional holidays - check if this region is in the counties list
      if (holiday.counties && holiday.counties.includes(regionCode)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Fetch holidays for a specific region (combines fetch and filter)
   */
  async fetchHolidaysForRegion(
    year: number,
    regionCode: string,
    countryCode: string = 'ES',
  ): Promise<NagerHoliday[]> {
    const allHolidays = await this.fetchHolidays(year, countryCode);
    return this.filterHolidaysByRegion(allHolidays, regionCode);
  }
}
