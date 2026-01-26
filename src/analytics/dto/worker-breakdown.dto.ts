export interface WorkerInfo {
  id: string;
  name: string;
  hourlyCost?: number; // Only included for admin/owner
}

export interface WorkerProjectItem {
  id: string;
  name: string;
  code: string;
  minutes: number;
  cost?: number; // Only included for admin/owner
}

export interface WorkerBreakdownResponse {
  worker: WorkerInfo;
  projects: WorkerProjectItem[];
}
