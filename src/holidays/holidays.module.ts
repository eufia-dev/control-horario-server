import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HolidaysController } from './holidays.controller.js';
import { HolidaysService } from './holidays.service.js';
import { NagerDateService } from './nager-date.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HolidaysController],
  providers: [HolidaysService, NagerDateService],
  exports: [HolidaysService, NagerDateService],
})
export class HolidaysModule {}
