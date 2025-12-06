export interface ProjectSummaryItem {
  id: string;
  name: string;
  code: string;
  totalMinutes: number;
  internalMinutes: number;
  externalMinutes: number;
  totalCost: number;
  internalCost: number;
  externalCost: number;
}

export interface ProjectsSummaryResponse {
  projects: ProjectSummaryItem[];
}
