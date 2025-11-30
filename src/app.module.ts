import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { CompaniesModule } from './companies/companies.module.js';
import { UsersModule } from './users/users.module.js';
import { ExternalsModule } from './externals/externals.module.js';
import { TimeEntriesModule } from './time-entries/time-entries.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    CompaniesModule,
    UsersModule,
    ExternalsModule,
    TimeEntriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
