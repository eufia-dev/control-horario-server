export interface ProjectSummaryItem {
  id: string;
  name: string;
  code: string;
  totalMinutes: number;
  totalCost: number;
}

export interface ProjectsSummaryResponse {
  projects: ProjectSummaryItem[];
}
