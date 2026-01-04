import type { AbsenceType, EntryType } from '@prisma/client';

export type DayStatus =
  | 'PUBLIC_HOLIDAY'
  | 'COMPANY_HOLIDAY'
  | 'ABSENCE'
  | 'NON_WORKING_DAY'
  | 'WORKED'
  | 'PARTIALLY_WORKED'
  | 'MISSING_LOGS'
  | 'FUTURE'
  | 'BEFORE_USER_CREATED';

export interface TimeEntryBrief {
  id: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  entryType: EntryType;
  projectId: string | null;
  projectName: string | null;
}

export interface CalendarDay {
  date: string; // ISO date string YYYY-MM-DD
  dayOfWeek: number; // 0 = Monday, 1 = Tuesday, ... 5 = Saturday, 6 = Sunday
  status: DayStatus;
  holidayName?: string;
  absenceType?: AbsenceType;
  expectedMinutes: number;
  loggedMinutes: number;
  entries: TimeEntryBrief[];
  isOvertime?: boolean; // Worked on a non-working day
  isOutsideMonth?: boolean; // Padding day from previous/next month (for month-based queries)
}

export interface CalendarSummary {
  workingDays: number;
  daysWorked: number;
  daysMissing: number;
  publicHolidays: number;
  absenceDays: number;
  totalExpectedMinutes: number;
  totalLoggedMinutes: number;
  compliancePercentage: number;
}

export interface CalendarResponse {
  userId: string;
  userName: string;
  from: string;
  to: string;
  days: CalendarDay[];
  summary: CalendarSummary;
}

export interface CalendarMonthResponse {
  userId: string;
  userName: string;
  year: number;
  month: number;
  from: string; // Actual display range start (including padding)
  to: string; // Actual display range end (including padding)
  days: CalendarDay[];
  summary: CalendarSummary; // Only counts days within the target month
}
