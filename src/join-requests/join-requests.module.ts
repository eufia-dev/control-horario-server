import { Module } from '@nestjs/common';
import { JoinRequestsController } from './join-requests.controller.js';
import { JoinRequestsService } from './join-requests.service.js';

@Module({
  imports: [],
  controllers: [JoinRequestsController],
  providers: [JoinRequestsService],
  exports: [JoinRequestsService],
})
export class JoinRequestsModule {}
