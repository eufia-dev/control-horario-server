import { Injectable } from '@nestjs/common';
import { getMunicipalitiesByProvince } from './dto/spain-municipalities.js';

@Injectable()
export class LocationsService {
  getMunicipalities(provinceCode: string): string[] {
    return getMunicipalitiesByProvince(provinceCode);
  }
}
