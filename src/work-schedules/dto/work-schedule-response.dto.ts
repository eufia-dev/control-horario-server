export interface WorkScheduleDayResponse {
  dayOfWeek: number; // 0=Monday, 6=Sunday
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  breakStartTime?: string; // HH:mm format
  breakEndTime?: string; // HH:mm format
}

export interface WorkScheduleResponse {
  days: WorkScheduleDayResponse[];
}
