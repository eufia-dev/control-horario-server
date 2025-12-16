import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [RemindersService],
})
export class RemindersModule {}

