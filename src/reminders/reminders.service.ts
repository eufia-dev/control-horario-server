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
    const currentDayOfWeek = (now.getDay() + 6) % 7;

    // 1. Fetch all active users with EMAIL reminders enabled
    const users = await this.prisma.user.findMany({
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
        company: true,
      },
    });

    if (users.length === 0) {
      this.logger.debug('No users with EMAIL reminders enabled');
      return;
    }

    // 2. Fetch schedules for today (company defaults and user overrides)
    const companyIds = [...new Set(users.map((u) => u.companyId))];
    const userIds = users.map((u) => u.id);

    const todaySchedules = await this.prisma.workSchedule.findMany({
      where: {
        dayOfWeek: currentDayOfWeek,
        OR: [
          { userId: { in: userIds } }, // User overrides
          {
            userId: null,
            companyId: { in: companyIds },
          }, // Company defaults
        ],
      },
    });

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

    // 3. Check each user
    for (const user of users) {
      const schedule =
        userOverrides.get(user.id) || companyDefaults.get(user.companyId);

      if (!schedule) {
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
    if (this.isWithinWindow(now, startTriggerTime, windowMs)) {
      const hasStartedToday = await this.hasStartedWorkToday(user.id, now);

      if (!hasStartedToday && !user.activeTimer) {
        await this.sendReminderEmail(user, 'start', schedule.startTime);
      }
    }

    // Check END reminder
    if (this.isWithinWindow(now, endTriggerTime, windowMs)) {
      if (user.activeTimer) {
        await this.sendReminderEmail(user, 'end', schedule.endTime);
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
   * Check if user has started work today (has any time entry)
   */
  private async hasStartedWorkToday(
    userId: string,
    now: Date,
  ): Promise<boolean> {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

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
    date.setHours(hours, minutes, 0, 0);
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

  /**
   * Send reminder email to user
   */
  private async sendReminderEmail(
    user: User,
    type: 'start' | 'end',
    scheduledTime: string,
  ) {
    // Skip if already sent today
    if (this.wasReminderSent(user.id, type)) {
      this.logger.debug(
        `Skipping ${type} reminder for ${user.email} (already sent today)`,
      );
      return;
    }

    const subject =
      type === 'start'
        ? 'Recordatorio: Inicio de jornada'
        : 'Recordatorio: Fin de jornada';

    const message =
      type === 'start'
        ? `Hola ${user.name}, según tu horario deberías haber empezado a trabajar a las ${scheduledTime}. No olvides registrar tu entrada.`
        : `Hola ${user.name}, tu jornada terminaba a las ${scheduledTime} y aún tienes un temporizador activo. No olvides registrar tu salida.`;

    const html = `
      <p>Hola <strong>${user.name}</strong>,</p>
      <p>${message}</p>
      <p>Accede a la plataforma para gestionar tu tiempo.</p>
      <p>Saludos cordiales,<br/>Equipo Eufia</p>
    `;

    this.logger.log(`Sending ${type} reminder to ${user.email}`);

    try {
      await this.emailService.sendEmail(subject, message, html, user.email);
      // Mark as sent only after successful send
      this.markReminderSent(user.id, type);
    } catch (error) {
      this.logger.error(`Failed to send email to ${user.email}`, error);
    }
  }
}
