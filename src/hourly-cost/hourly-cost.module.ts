import { Module } from '@nestjs/common';
import { HourlyCostService } from './hourly-cost.service.js';

@Module({
  providers: [HourlyCostService],
  exports: [HourlyCostService],
})
export class HourlyCostModule {}
