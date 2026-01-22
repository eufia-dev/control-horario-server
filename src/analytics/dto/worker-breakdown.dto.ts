export interface WorkerInfo {
  id: string;
  name: string;
  hourlyCost: number;
}

export interface WorkerProjectItem {
  id: string;
  name: string;
  code: string;
  minutes: number;
  cost: number;
}

export interface WorkerBreakdownResponse {
  worker: WorkerInfo;
  projects: WorkerProjectItem[];
}
