export interface WorkerSummaryItem {
  id: string;
  name: string;
  hourlyCost?: number; // Only included for admin/owner
  totalMinutes: number;
  totalCost?: number; // Only included for admin/owner
}

export interface WorkersSummaryResponse {
  workers: WorkerSummaryItem[];
}
