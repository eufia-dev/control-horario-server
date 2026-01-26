export interface ProjectSummaryItem {
  id: string;
  name: string;
  code: string;
  totalMinutes: number;
  totalCost?: number; // Only included for admin/owner
}

export interface ProjectsSummaryResponse {
  projects: ProjectSummaryItem[];
}
