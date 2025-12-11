// ISO 3166-2:ES codes for Spanish autonomous communities
export interface SpainRegion {
  code: string;
  name: string;
}

export const SPAIN_REGIONS: SpainRegion[] = [
  { code: 'ES-AN', name: 'Andalucía' },
  { code: 'ES-AR', name: 'Aragón' },
  { code: 'ES-AS', name: 'Asturias' },
  { code: 'ES-CB', name: 'Cantabria' },
  { code: 'ES-CL', name: 'Castilla y León' },
  { code: 'ES-CM', name: 'Castilla-La Mancha' },
  { code: 'ES-CT', name: 'Cataluña' },
  { code: 'ES-CE', name: 'Ceuta' },
  { code: 'ES-EX', name: 'Extremadura' },
  { code: 'ES-GA', name: 'Galicia' },
  { code: 'ES-IB', name: 'Islas Baleares' },
  { code: 'ES-CN', name: 'Islas Canarias' },
  { code: 'ES-RI', name: 'La Rioja' },
  { code: 'ES-MD', name: 'Madrid' },
  { code: 'ES-ML', name: 'Melilla' },
  { code: 'ES-MC', name: 'Murcia' },
  { code: 'ES-NC', name: 'Navarra' },
  { code: 'ES-PV', name: 'País Vasco' },
  { code: 'ES-VC', name: 'Comunidad Valenciana' },
];

export function getRegionName(code: string): string | undefined {
  const region = SPAIN_REGIONS.find((r) => r.code === code);
  return region?.name;
}

export function isValidRegionCode(code: string): boolean {
  return SPAIN_REGIONS.some((r) => r.code === code);
}
