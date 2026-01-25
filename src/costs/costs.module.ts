import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CostsController } from './costs.controller.js';
import { CostsService } from './costs.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CostsController],
  providers: [CostsService],
  exports: [CostsService],
})
export class CostsModule {}
