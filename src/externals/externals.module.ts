import { Module } from '@nestjs/common';
import { ExternalsController } from './externals.controller.js';
import { ExternalsService } from './externals.service.js';

@Module({
  imports: [],
  controllers: [ExternalsController],
  providers: [ExternalsService],
  exports: [ExternalsService],
})
export class ExternalsModule {}
