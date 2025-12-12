import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { AdminGuard } from './admin.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OnboardingGuard } from './onboarding.guard.js';

@Global()
@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AdminGuard, OnboardingGuard],
  exports: [AuthService, JwtAuthGuard, AdminGuard, OnboardingGuard],
})
export class AuthModule {}
