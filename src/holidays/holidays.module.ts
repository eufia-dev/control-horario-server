import { Module, forwardRef } from '@nestjs/common';
import { HolidaysController } from './holidays.controller.js';
import { HolidaysService } from './holidays.service.js';
import { NagerDateService } from './nager-date.service.js';
import { AbsencesModule } from '../absences/absences.module.js';

@Module({
  imports: [forwardRef(() => AbsencesModule)],
  controllers: [HolidaysController],
  providers: [HolidaysService, NagerDateService],
  exports: [HolidaysService, NagerDateService],
})
export class HolidaysModule {}
