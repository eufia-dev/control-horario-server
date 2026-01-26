export interface WorkerBreakdownItem {
  id: string;
  name: string;
  minutes: number;
  hourlyCost?: number; // Only included for admin/owner
  totalCost?: number; // Only included for admin/owner
}

export interface ProjectBreakdownResponse {
  workers: WorkerBreakdownItem[];
}
