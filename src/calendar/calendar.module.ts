import { Module } from '@nestjs/common';
import { HolidaysModule } from '../holidays/holidays.module.js';
import { AbsencesModule } from '../absences/absences.module.js';
import { TimeEntriesModule } from '../time-entries/time-entries.module.js';
import { WorkSchedulesModule } from '../work-schedules/work-schedules.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';

@Module({
  imports: [
    HolidaysModule,
    AbsencesModule,
    TimeEntriesModule,
    WorkSchedulesModule,
    AuthModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
