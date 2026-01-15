import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HourlyCostModule } from '../hourly-cost/hourly-cost.module.js';
import { WorkSchedulesController } from './work-schedules.controller.js';
import { WorkSchedulesService } from './work-schedules.service.js';

@Module({
  imports: [AuthModule, HourlyCostModule],
  controllers: [WorkSchedulesController],
  providers: [WorkSchedulesService],
  exports: [WorkSchedulesService],
})
export class WorkSchedulesModule {}
