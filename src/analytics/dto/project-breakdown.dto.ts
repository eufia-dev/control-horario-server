export interface WorkerBreakdownItem {
  id: string;
  name: string;
  minutes: number;
  hourlyCost: number;
  totalCost: number;
}

export interface ProjectBreakdownResponse {
  workers: WorkerBreakdownItem[];
}
