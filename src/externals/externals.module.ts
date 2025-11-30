import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ExternalsController } from './externals.controller.js';
import { ExternalsService } from './externals.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ExternalsController],
  providers: [ExternalsService],
  exports: [ExternalsService],
})
export class ExternalsModule {}

