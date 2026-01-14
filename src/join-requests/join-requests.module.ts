import { Module } from '@nestjs/common';
import { JoinRequestsController } from './join-requests.controller.js';
import { JoinRequestsService } from './join-requests.service.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [EmailModule],
  controllers: [JoinRequestsController],
  providers: [JoinRequestsService],
  exports: [JoinRequestsService],
})
export class JoinRequestsModule {}
