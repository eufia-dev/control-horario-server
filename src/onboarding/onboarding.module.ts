import { forwardRef, Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';
import { HolidaysModule } from '../holidays/holidays.module.js';
import { JoinRequestsModule } from '../join-requests/join-requests.module.js';

@Module({
  imports: [HolidaysModule, forwardRef(() => JoinRequestsModule)],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
