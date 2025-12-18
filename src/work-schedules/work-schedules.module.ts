import { Module } from '@nestjs/common';
import { WorkSchedulesController } from './work-schedules.controller.js';
import { WorkSchedulesService } from './work-schedules.service.js';

@Module({
  imports: [],
  controllers: [WorkSchedulesController],
  providers: [WorkSchedulesService],
  exports: [WorkSchedulesService],
})
export class WorkSchedulesModule {}
