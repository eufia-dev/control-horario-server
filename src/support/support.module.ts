import { Module } from '@nestjs/common';
import { SupportController } from './support.controller.js';
import { SupportService } from './support.service.js';
import { EmailModule } from '../email/email.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [EmailModule, PrismaModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
