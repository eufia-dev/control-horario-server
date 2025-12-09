import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { CompaniesModule } from './companies/companies.module.js';
import { UsersModule } from './users/users.module.js';
import { ExternalsModule } from './externals/externals.module.js';
import { TimeEntriesModule } from './time-entries/time-entries.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { JoinRequestsModule } from './join-requests/join-requests.module.js';
import { SupportModule } from './support/support.module.js';

@Module({
  imports: [
    PrismaModule,
    SupabaseModule,
    AuthModule,
    ProjectsModule,
    CompaniesModule,
    UsersModule,
    ExternalsModule,
    TimeEntriesModule,
    AnalyticsModule,
    OnboardingModule,
    InvitationsModule,
    JoinRequestsModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
