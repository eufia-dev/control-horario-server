import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import type {
  User,
  WorkSchedule,
  NotificationSettings,
  ActiveTimer,
} from '@prisma/client';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  // Track sent reminders: "userId:type" (e.g., "abc123:start")
  // Cleared daily to avoid memory buildup
  private sentReminders = new Set<string>();
  private lastClearDate = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleReminders() {
    const remindersEnabled = process.env.ENABLE_REMINDERS !== 'false';
    if (!remindersEnabled) {
      this.logger.debug(
        'Reminders are disabled via ENABLE_REMINDERS environment variable',
      );
      return;
    }

    const now = new Date();
    const todayKey = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Clear cache at midnight (new day)
    if (this.lastClearDate !== todayKey) {
      this.sentReminders.clear();
      this.lastClearDate = todayKey;
      this.logger.log('Cleared reminder cache for new day');
    }

    this.logger.log('Checking schedule reminders...');
    // Convert JS getDay() (0=Sunday..6=Saturday) to work schedule format (0=Monday..6=Sunday)
    const currentDayOfWeek = (now.getUTCDay() + 6) % 7;

    // Normalize today for date comparisons
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    // 1. Check if today is a national public holiday - if yes, skip all reminders
    const nationalHoliday = await this.prisma.publicHoliday.findFirst({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        country: 'ES',
        regionCode: null, // National holiday
      },
    });

    if (nationalHoliday) {
      this.logger.debug(
        `Skipping all reminders - today is a national holiday: ${nationalHoliday.name}`,
      );
      return;
    }

    // 2. Fetch users and check holidays/absences in parallel
    const [users, regionalHolidays] = await Promise.all([
      // Fetch all active users with EMAIL reminders enabled
      this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          notificationSettings: {
            enableReminders: true,
            channel: 'EMAIL',
          },
        },
        include: {
          notificationSettings: true,
          activeTimer: true,
          company: {
            include: {
              location: true,
            },
          },
        },
      }),
      // Fetch all regional public holidays for today (we'll filter by region later)
      this.prisma.publicHoliday.findMany({
        where: {
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
          country: 'ES',
          regionCode: { not: null }, // Only regional holidays
        },
        select: {
          regionCode: true,
        },
      }),
    ]);

    if (users.length === 0) {
      this.logger.debug('No users with EMAIL reminders enabled');
      return;
    }

    // 3. Filter out companies with holidays today
    const companyIds = [...new Set(users.map((u) => u.companyId))];
    const companiesWithHolidays = await this.getCompaniesWithHolidays(
      companyIds,
      now,
      regionalHolidays,
    );
    const companiesWithHolidaysSet = new Set(companiesWithHolidays);

    // Filter out users from companies with holidays
    let eligibleUsers = users.filter(
      (u) => !companiesWithHolidaysSet.has(u.companyId),
    );

    if (eligibleUsers.length === 0) {
      this.logger.debug('No eligible users (all companies have holidays)');
      return;
    }

    // 4. Filter out users with absences today (parallel with schedule fetch)
    const eligibleUserIds = eligibleUsers.map((u) => u.id);
    const eligibleCompanyIds = [
      ...new Set(eligibleUsers.map((u) => u.companyId)),
    ];

    const [usersWithAbsences, todaySchedules] = await Promise.all([
      // Get users with absences
      this.getUsersWithAbsences(eligibleUserIds, now),
      // Fetch schedules for today (company defaults and user overrides)
      this.prisma.workSchedule.findMany({
        where: {
          dayOfWeek: currentDayOfWeek,
          OR: [
            { userId: { in: eligibleUserIds } }, // User overrides
            {
              userId: null,
              companyId: { in: eligibleCompanyIds },
            }, // Company defaults
          ],
        },
      }),
    ]);

    const usersWithAbsencesSet = new Set(usersWithAbsences);
    eligibleUsers = eligibleUsers.filter(
      (u) => !usersWithAbsencesSet.has(u.id),
    );

    if (eligibleUsers.length === 0) {
      this.logger.debug('No eligible users (all users have absences)');
      return;
    }

    // Build maps for quick lookup
    const companyDefaults = new Map<string, WorkSchedule>();
    const userOverrides = new Map<string, WorkSchedule>();

    todaySchedules.forEach((schedule) => {
      if (schedule.userId) {
        userOverrides.set(schedule.userId, schedule);
      } else {
        // Company defaults - only keep one per company (should be unique anyway)
        if (!companyDefaults.has(schedule.companyId)) {
          companyDefaults.set(schedule.companyId, schedule);
        }
      }
    });

    // 5. Check each eligible user
    for (const user of eligibleUsers) {
      const schedule =
        userOverrides.get(user.id) || companyDefaults.get(user.companyId);

      if (!schedule) {
        this.logger.debug(`No work scheduled for ${user.email} today`);
        continue; // No work scheduled for today
      }

      await this.checkUserReminder(
        user as User & {
          notificationSettings: NotificationSettings | null;
          activeTimer: ActiveTimer | null;
        },
        schedule,
        now,
      );
    }
  }

  private async checkUserReminder(
    user: User & {
      notificationSettings: NotificationSettings | null;
      activeTimer: ActiveTimer | null;
    },
    schedule: WorkSchedule,
    now: Date,
  ) {
    // Check if reminders were already sent today - skip early if so
    const startReminderSent = this.wasReminderSent(user.id, 'start');
    const endReminderSent = this.wasReminderSent(user.id, 'end');

    // If both reminders already sent, skip all logic
    if (startReminderSent && endReminderSent) {
      return;
    }

    const toleranceMinutes = user.notificationSettings?.toleranceMinutes ?? 15;

    // Parse schedule times for today
    const startTimeDate = this.getDateFromTimeString(schedule.startTime, now);
    const endTimeDate = this.getDateFromTimeString(schedule.endTime, now);

    // Calculate trigger times (schedule time + tolerance)
    const startTriggerTime = new Date(
      startTimeDate.getTime() + toleranceMinutes * 60000,
    );
    const endTriggerTime = new Date(
      endTimeDate.getTime() + toleranceMinutes * 60000,
    );

    // Window to avoid sending emails repeatedly (matches cron interval: 5 minutes)
    const windowMs = 5 * 60 * 1000;

    // Check START reminder
    if (
      !startReminderSent &&
      this.isWithinWindow(now, startTriggerTime, windowMs)
    ) {
      this.logger.debug(`Checking start reminder for ${user.email}`);
      this.logger.debug(
        `Start trigger time: ${startTriggerTime.toISOString()}`,
      );
      this.logger.debug(`Window: ${windowMs} milliseconds`);
      this.logger.debug(`Now: ${now.toISOString()}`);
      const hasStartedToday = await this.hasStartedWorkToday(user.id, now);

      if (!hasStartedToday && !user.activeTimer) {
        this.logger.log(`Sending start reminder to ${user.email}`);

        try {
          await this.emailService.sendReminderEmail({
            to: user.email,
            userName: user.name,
            type: 'start',
            scheduledTime: schedule.startTime,
          });
          // Mark as sent only after successful send
          this.markReminderSent(user.id, 'start');
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : JSON.stringify(error);
          this.logger.error(
            `Failed to send email to ${user.email}: ${message}`,
          );
        }
      }
    }

    // Check END reminder
    if (
      !endReminderSent &&
      this.isWithinWindow(now, endTriggerTime, windowMs)
    ) {
      if (user.activeTimer) {
        this.logger.log(`Sending end reminder to ${user.email}`);

        try {
          await this.emailService.sendReminderEmail({
            to: user.email,
            userName: user.name,
            type: 'end',
            scheduledTime: schedule.endTime,
          });
          // Mark as sent only after successful send
          this.markReminderSent(user.id, 'end');
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : JSON.stringify(error);
          this.logger.error(
            `Failed to send email to ${user.email}: ${message}`,
          );
        }
      }
    }
  }

  /**
   * Check if current time is within the reminder window
   * (between targetTime and targetTime + windowMs)
   */
  private isWithinWindow(
    now: Date,
    targetTime: Date,
    windowMs: number,
  ): boolean {
    const diff = now.getTime() - targetTime.getTime();

    return diff >= 0 && diff < windowMs;
  }

  /**
   * Get companies that have holidays today (public regional or company holidays)
   * Note: National holidays are checked before calling this method
   * Returns array of company IDs
   */
  private async getCompaniesWithHolidays(
    companyIds: string[],
    today: Date,
    regionalHolidays: Array<{ regionCode: string | null }>,
  ): Promise<string[]> {
    if (companyIds.length === 0) {
      return [];
    }

    // Normalize today to start of day for date comparison
    const todayStart = new Date(today);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setUTCHours(23, 59, 59, 999);

    // Fetch company locations and holidays in parallel
    const [companyLocations, exactDateHolidays, recurringHolidays] =
      await Promise.all([
        // Get company locations to check regional holidays
        this.prisma.companyLocation.findMany({
          where: {
            companyId: { in: companyIds },
          },
          select: {
            companyId: true,
            regionCode: true,
          },
        }),
        // Get company holidays with exact date match
        this.prisma.companyHoliday.findMany({
          where: {
            companyId: { in: companyIds },
            isRecurring: false,
            date: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          select: {
            companyId: true,
          },
        }),
        // Get all recurring company holidays (we'll filter by month/day in code)
        this.prisma.companyHoliday.findMany({
          where: {
            companyId: { in: companyIds },
            isRecurring: true,
          },
          select: {
            companyId: true,
            date: true,
          },
        }),
      ]);

    const companiesWithHolidays = new Set<string>();

    // Add companies with exact date holidays
    exactDateHolidays.forEach((holiday) => {
      companiesWithHolidays.add(holiday.companyId);
    });

    // Add companies with recurring holidays that match today's month/day

    const todayMonth = today.getUTCMonth();
    const todayDate = today.getUTCDate();
    recurringHolidays.forEach((holiday) => {
      const holidayDate = new Date(holiday.date);
      if (
        holidayDate.getUTCMonth() === todayMonth &&
        holidayDate.getUTCDate() === todayDate
      ) {
        companiesWithHolidays.add(holiday.companyId);
      }
    });

    // Build reverse map: regionCode -> Set of company IDs for efficient lookup
    const companiesByRegion = new Map<string, Set<string>>();
    companyLocations.forEach((loc) => {
      if (loc.regionCode) {
        if (!companiesByRegion.has(loc.regionCode)) {
          companiesByRegion.set(loc.regionCode, new Set());
        }
        companiesByRegion.get(loc.regionCode)!.add(loc.companyId);
      }
    });

    // Add companies with regional public holidays
    regionalHolidays.forEach((holiday) => {
      if (holiday.regionCode) {
        const companiesInRegion = companiesByRegion.get(holiday.regionCode);
        if (companiesInRegion) {
          companiesInRegion.forEach((companyId) => {
            companiesWithHolidays.add(companyId);
          });
        }
      }
    });

    return Array.from(companiesWithHolidays);
  }

  /**
   * Get users that have absences today
   * Returns array of user IDs
   */
  private async getUsersWithAbsences(
    userIds: string[],
    today: Date,
  ): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }

    // Normalize today to start of day for date comparison
    const todayStart = new Date(today);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setUTCHours(23, 59, 59, 999);

    // Find absences that overlap with today (only APPROVED absences)
    const absences = await this.prisma.userAbsence.findMany({
      where: {
        userId: { in: userIds },
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      select: {
        userId: true,
      },
    });

    return absences.map((absence) => absence.userId);
  }

  /**
   * Check if user has started work today (has any time entry)
   */
  private async hasStartedWorkToday(
    userId: string,
    now: Date,
  ): Promise<boolean> {
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const count = await this.prisma.timeEntry.count({
      where: {
        userId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return count > 0;
  }

  /**
   * Convert time string (HH:MM) to Date object for today
   */
  private getDateFromTimeString(timeString: string, referenceDate: Date): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date(referenceDate);
    // fix this
    // check this
    date.setHours(hours + 1, minutes, 0, 0); // Add 1 hour to the time
    return date;
  }

  /**
   * Check if reminder was already sent today
   */
  private wasReminderSent(userId: string, type: 'start' | 'end'): boolean {
    const key = `${userId}:${type}`;
    return this.sentReminders.has(key);
  }

  /**
   * Mark reminder as sent for today
   */
  private markReminderSent(userId: string, type: 'start' | 'end'): void {
    const key = `${userId}:${type}`;
    this.sentReminders.add(key);
  }
}
