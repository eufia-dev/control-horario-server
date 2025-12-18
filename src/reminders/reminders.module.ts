import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [EmailModule],
  providers: [RemindersService],
})
export class RemindersModule {}
