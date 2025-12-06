export interface WorkerSummaryItem {
  id: string;
  name: string;
  type: 'internal' | 'external';
  hourlyCost: number;
  totalMinutes: number;
  totalCost: number;
}

export interface WorkersSummaryResponse {
  workers: WorkerSummaryItem[];
}
