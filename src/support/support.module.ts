import { Module } from '@nestjs/common';
import { SupportController } from './support.controller.js';
import { SupportService } from './support.service.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [EmailModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
