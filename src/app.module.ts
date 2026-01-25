import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { CompaniesModule } from './companies/companies.module.js';
import { UsersModule } from './users/users.module.js';
import { TimeEntriesModule } from './time-entries/time-entries.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { JoinRequestsModule } from './join-requests/join-requests.module.js';
import { SupportModule } from './support/support.module.js';
import { HolidaysModule } from './holidays/holidays.module.js';
import { AbsencesModule } from './absences/absences.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { WorkSchedulesModule } from './work-schedules/work-schedules.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { CostsModule } from './costs/costs.module.js';
import { ProvidersModule } from './providers/providers.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    ProjectsModule,
    CompaniesModule,
    UsersModule,
    TimeEntriesModule,
    AnalyticsModule,
    OnboardingModule,
    InvitationsModule,
    JoinRequestsModule,
    SupportModule,
    HolidaysModule,
    AbsencesModule,
    CalendarModule,
    LocationsModule,
    WorkSchedulesModule,
    RemindersModule,
    TeamsModule,
    CostsModule,
    ProvidersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
