import { Global, Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { JoinRequestsModule } from '../join-requests/join-requests.module.js';
import { AdminGuard } from './admin.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OnboardingGuard } from './onboarding.guard.js';
import { TeamLeaderGuard } from './team-leader.guard.js';
import { TeamScopeService } from './team-scope.service.js';
import { UserAccessGuard } from './user-access.guard.js';

@Global()
@Module({
  imports: [SupabaseModule, forwardRef(() => JoinRequestsModule)],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    AdminGuard,
    OnboardingGuard,
    TeamLeaderGuard,
    TeamScopeService,
    UserAccessGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    AdminGuard,
    OnboardingGuard,
    TeamLeaderGuard,
    TeamScopeService,
    UserAccessGuard,
  ],
})
export class AuthModule {}
