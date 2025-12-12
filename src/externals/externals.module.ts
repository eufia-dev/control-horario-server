import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ExternalsController } from './externals.controller.js';
import { ExternalsService } from './externals.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ExternalsController],
  providers: [ExternalsService],
  exports: [ExternalsService],
})
export class ExternalsModule {}
