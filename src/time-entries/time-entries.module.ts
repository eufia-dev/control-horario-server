import { Module } from '@nestjs/common';
import { TimeEntriesController } from './time-entries.controller.js';
import { TimeEntriesService } from './time-entries.service.js';

@Module({
  imports: [],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
