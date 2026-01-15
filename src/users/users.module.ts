import { Module } from '@nestjs/common';
import { HourlyCostModule } from '../hourly-cost/hourly-cost.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [HourlyCostModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
