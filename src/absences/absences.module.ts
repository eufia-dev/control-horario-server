import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AbsencesController } from './absences.controller.js';
import { AbsencesService } from './absences.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AbsencesController],
  providers: [AbsencesService],
  exports: [AbsencesService],
})
export class AbsencesModule {}
