import { Module } from '@nestjs/common';
import { SupportController } from './support.controller.js';
import { SupportService } from './support.service.js';
import { EmailModule } from '../email/email.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [EmailModule, PrismaModule, AuthModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
