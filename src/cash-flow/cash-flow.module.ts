import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CashFlowController } from './cash-flow.controller.js';
import { CashFlowService } from './cash-flow.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CashFlowController],
  providers: [CashFlowService],
  exports: [CashFlowService],
})
export class CashFlowModule {}
