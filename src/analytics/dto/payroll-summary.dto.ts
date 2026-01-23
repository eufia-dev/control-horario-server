import { IsDateString } from 'class-validator';

export class PayrollSummaryQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export interface PayrollUserSummary {
  id: string;
  name: string;
  email: string;
  team: { id: string; name: string } | null;
  hourlyCost: number;
  expectedMinutes: number;
  loggedMinutes: number;
  differenceMinutes: number;
  expectedWorkDays: number;
  daysWorked: number;
  daysMissing: number;
  vacationDays: number;
  sickLeaveDays: number;
  otherAbsenceDays: number;
  coffeePauseMinutes: number;
  totalCost: number;
}

export interface PayrollSummaryTotals {
  expectedMinutes: number;
  loggedMinutes: number;
  differenceMinutes: number;
  vacationDays: number;
  sickLeaveDays: number;
  otherAbsenceDays: number;
  coffeePauseMinutes: number;
  totalCost: number;
}

export interface PayrollSummaryResponse {
  startDate: string;
  endDate: string;
  users: PayrollUserSummary[];
  totals: PayrollSummaryTotals;
}
