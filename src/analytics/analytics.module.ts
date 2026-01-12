import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { WorkSchedulesModule } from '../work-schedules/work-schedules.module.js';
import { HolidaysModule } from '../holidays/holidays.module.js';
import { AbsencesModule } from '../absences/absences.module.js';
import { TimeEntriesModule } from '../time-entries/time-entries.module.js';

@Module({
  imports: [
    WorkSchedulesModule,
    HolidaysModule,
    AbsencesModule,
    TimeEntriesModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
