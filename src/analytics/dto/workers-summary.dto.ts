export interface WorkerSummaryItem {
  id: string;
  name: string;
  hourlyCost: number;
  totalMinutes: number;
  totalCost: number;
}

export interface WorkersSummaryResponse {
  workers: WorkerSummaryItem[];
}
