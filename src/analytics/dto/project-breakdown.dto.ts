export interface WorkerBreakdownItem {
  id: string;
  name: string;
  type: 'internal' | 'external';
  minutes: number;
  hourlyCost: number;
  totalCost: number;
}

export interface ProjectBreakdownResponse {
  workers: WorkerBreakdownItem[];
}

