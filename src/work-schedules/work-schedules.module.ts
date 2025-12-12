import { Module } from '@nestjs/common';
import { WorkSchedulesController } from './work-schedules.controller.js';
import { WorkSchedulesService } from './work-schedules.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [WorkSchedulesController],
  providers: [WorkSchedulesService],
  exports: [WorkSchedulesService],
})
export class WorkSchedulesModule {}
