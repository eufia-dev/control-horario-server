import { Module } from '@nestjs/common';
import { HolidaysModule } from '../holidays/holidays.module.js';
import { CompaniesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';

@Module({
  imports: [HolidaysModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
