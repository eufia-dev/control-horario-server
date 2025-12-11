import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AbsencesController } from './absences.controller.js';
import { AbsencesService } from './absences.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AbsencesController],
  providers: [AbsencesService],
  exports: [AbsencesService],
})
export class AbsencesModule {}
