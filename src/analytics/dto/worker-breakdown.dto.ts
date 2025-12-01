import { IsIn, IsNotEmpty } from 'class-validator';

export class WorkerBreakdownQueryDto {
  @IsIn(['internal', 'external'])
  @IsNotEmpty()
  type: 'internal' | 'external';
}

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
  workerType: 'internal' | 'external';
  worker: WorkerInfo;
  projects: WorkerProjectItem[];
}

