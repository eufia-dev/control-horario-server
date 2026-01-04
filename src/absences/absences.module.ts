import { Module, forwardRef } from '@nestjs/common';
import { AbsencesController } from './absences.controller.js';
import { AbsencesService } from './absences.service.js';
import { HolidaysModule } from '../holidays/holidays.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [forwardRef(() => HolidaysModule), EmailModule],
  controllers: [AbsencesController],
  providers: [AbsencesService],
  exports: [AbsencesService],
})
export class AbsencesModule {}
