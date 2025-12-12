import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HolidaysModule } from '../holidays/holidays.module.js';

@Module({
  imports: [PrismaModule, HolidaysModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
