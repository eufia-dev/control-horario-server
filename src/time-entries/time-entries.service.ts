import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto.js';
import { AdminCreateTimeEntryDto } from './dto/admin-create-time-entry.dto.js';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto.js';
import { StartTimerDto } from './dto/start-timer.dto.js';
import { SwitchTimerDto } from './dto/switch-timer.dto.js';
import type {
  TimeEntry,
  ActiveTimer,
  EntryType,
  EntrySource,
} from '@prisma/client';

export interface TimeEntryResponse {
  id: string;
  userId: string;
  projectId: string | null;
  companyId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  entryType: EntryType;
  source: EntrySource;
  isManual: boolean;
  isModified: boolean;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
}

export interface DeletedTimeEntryResponse {
  id: string;
  userId: string;
  projectId: string | null;
  companyId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  entryType: EntryType;
  createdAt: Date;
}

export interface ActiveTimerResponse {
  id: string;
  userId: string;
  projectId: string | null;
  companyId: string;
  startTime: Date;
  entryType: EntryType;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
}

export interface SwitchTimerResponse {
  stoppedEntry: TimeEntryResponse;
  activeTimer: ActiveTimerResponse;
}

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // ADMIN METHODS (no ownership checks needed)
  // ============================================

  async findAll(
    companyId: string,
    userId?: string,
  ): Promise<TimeEntryResponse[]> {
    const whereClause: { companyId: string; userId?: string } = { companyId };

    if (userId) {
      whereClause.userId = userId;
    }

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    return timeEntries.map((entry) => this.toTimeEntryResponse(entry));
  }

  async findOne(id: string, companyId: string): Promise<TimeEntryResponse> {
    const timeEntry = await this.prisma.timeEntry.findFirst({
      where: { id, companyId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!timeEntry) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    return this.toTimeEntryResponse(timeEntry);
  }

  async adminCreate(
    dto: AdminCreateTimeEntryDto,
    companyId: string,
  ): Promise<TimeEntryResponse> {
    // Verify the user belongs to the company
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, companyId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${dto.userId} no encontrado`);
    }

    return this.createEntry(dto, dto.userId, companyId);
  }

  async update(
    id: string,
    updateTimeEntryDto: UpdateTimeEntryDto,
    companyId: string,
  ): Promise<TimeEntryResponse> {
    const existing = await this.prisma.timeEntry.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    return this.updateEntry(id, updateTimeEntryDto, companyId);
  }

  async remove(
    id: string,
    companyId: string,
  ): Promise<DeletedTimeEntryResponse> {
    const existing = await this.prisma.timeEntry.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    const deleted = await this.prisma.timeEntry.delete({
      where: { id },
    });

    return this.toDeletedTimeEntryResponse(deleted);
  }

  // ============================================
  // USER METHODS (scoped to current user)
  // ============================================

  async findMyEntries(
    userId: string,
    companyId: string,
  ): Promise<TimeEntryResponse[]> {
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { userId, companyId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    return timeEntries.map((entry) => this.toTimeEntryResponse(entry));
  }

  async findMyOne(
    id: string,
    userId: string,
    companyId: string,
  ): Promise<TimeEntryResponse> {
    const timeEntry = await this.prisma.timeEntry.findFirst({
      where: { id, userId, companyId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!timeEntry) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    return this.toTimeEntryResponse(timeEntry);
  }

  async create(
    createTimeEntryDto: CreateTimeEntryDto,
    userId: string,
    companyId: string,
  ): Promise<TimeEntryResponse> {
    return this.createEntry(createTimeEntryDto, userId, companyId);
  }

  async updateMine(
    id: string,
    updateTimeEntryDto: UpdateTimeEntryDto,
    userId: string,
    companyId: string,
  ): Promise<TimeEntryResponse> {
    const existing = await this.prisma.timeEntry.findFirst({
      where: { id, userId, companyId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    return this.updateEntry(id, updateTimeEntryDto, companyId);
  }

  async removeMine(
    id: string,
    userId: string,
    companyId: string,
  ): Promise<DeletedTimeEntryResponse> {
    const existing = await this.prisma.timeEntry.findFirst({
      where: { id, userId, companyId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    const deleted = await this.prisma.timeEntry.delete({
      where: { id },
    });

    return this.toDeletedTimeEntryResponse(deleted);
  }

  // ============================================
  // TIMER METHODS (start, stop, switch)
  // ============================================

  async getActiveTimer(
    userId: string,
    companyId: string,
  ): Promise<ActiveTimerResponse | null> {
    const activeTimer = await this.prisma.activeTimer.findFirst({
      where: { userId, companyId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!activeTimer) {
      return null;
    }

    return this.toActiveTimerResponse(activeTimer);
  }

  async startTimer(
    dto: StartTimerDto,
    userId: string,
    companyId: string,
  ): Promise<ActiveTimerResponse> {
    // Check if user already has an active timer
    const existingTimer = await this.prisma.activeTimer.findUnique({
      where: { userId },
    });

    if (existingTimer) {
      throw new ConflictException(
        'Ya tienes un temporizador activo. Debes detenerlo antes de iniciar uno nuevo.',
      );
    }

    // Verify project belongs to company if provided
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, companyId },
      });

      if (!project) {
        throw new NotFoundException(
          `Proyecto con ID ${dto.projectId} no encontrado`,
        );
      }
    }

    const activeTimer = await this.prisma.activeTimer.create({
      data: {
        userId,
        companyId,
        projectId: dto.projectId,
        startTime: new Date(),
        entryType: dto.entryType ?? 'WORK',
        lat: dto.lat,
        lng: dto.lng,
        ipAddress: dto.ipAddress,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return this.toActiveTimerResponse(activeTimer);
  }

  async stopTimer(
    userId: string,
    companyId: string,
    endData?: { lat?: number; lng?: number; ipAddress?: string },
  ): Promise<TimeEntryResponse> {
    const activeTimer = await this.prisma.activeTimer.findFirst({
      where: { userId, companyId },
    });

    if (!activeTimer) {
      throw new NotFoundException('No tienes ningún temporizador activo');
    }

    const endTime = new Date();
    const durationMinutes = Math.round(
      (endTime.getTime() - activeTimer.startTime.getTime()) / 60000,
    );

    // Use a transaction to ensure atomicity
    const [, timeEntry] = await this.prisma.$transaction([
      this.prisma.activeTimer.delete({
        where: { id: activeTimer.id },
      }),
      this.prisma.timeEntry.create({
        data: {
          userId: activeTimer.userId,
          companyId: activeTimer.companyId,
          projectId: activeTimer.projectId,
          startTime: activeTimer.startTime,
          endTime,
          durationMinutes: durationMinutes > 0 ? durationMinutes : 1,
          entryType: activeTimer.entryType,
          source: 'WEB',
          startLat: activeTimer.lat,
          startLng: activeTimer.lng,
          startIp: activeTimer.ipAddress,
          endLat: endData?.lat,
          endLng: endData?.lng,
          endIp: endData?.ipAddress,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
    ]);

    return this.toTimeEntryResponse(timeEntry);
  }

  async switchTimer(
    dto: SwitchTimerDto,
    userId: string,
    companyId: string,
  ): Promise<SwitchTimerResponse> {
    const activeTimer = await this.prisma.activeTimer.findFirst({
      where: { userId, companyId },
    });

    if (!activeTimer) {
      throw new NotFoundException(
        'No tienes ningún temporizador activo para cambiar',
      );
    }

    // Verify new project belongs to company if provided
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, companyId },
      });

      if (!project) {
        throw new NotFoundException(
          `Proyecto con ID ${dto.projectId} no encontrado`,
        );
      }
    }

    const switchTime = new Date();
    const durationMinutes = Math.round(
      (switchTime.getTime() - activeTimer.startTime.getTime()) / 60000,
    );

    // Use a transaction: delete old timer, create time entry, create new timer
    const [, timeEntry, newActiveTimer] = await this.prisma.$transaction([
      this.prisma.activeTimer.delete({
        where: { id: activeTimer.id },
      }),
      this.prisma.timeEntry.create({
        data: {
          userId: activeTimer.userId,
          companyId: activeTimer.companyId,
          projectId: activeTimer.projectId,
          startTime: activeTimer.startTime,
          endTime: switchTime,
          durationMinutes: durationMinutes > 0 ? durationMinutes : 1,
          entryType: activeTimer.entryType,
          source: 'WEB',
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      this.prisma.activeTimer.create({
        data: {
          userId,
          companyId,
          projectId: dto.projectId,
          startTime: switchTime,
          entryType: dto.entryType ?? 'WORK',
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
    ]);

    return {
      stoppedEntry: this.toTimeEntryResponse(timeEntry),
      activeTimer: this.toActiveTimerResponse(newActiveTimer),
    };
  }

  async cancelTimer(
    userId: string,
    companyId: string,
  ): Promise<ActiveTimerResponse> {
    const activeTimer = await this.prisma.activeTimer.findFirst({
      where: { userId, companyId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!activeTimer) {
      throw new NotFoundException('No tienes ningún temporizador activo');
    }

    await this.prisma.activeTimer.delete({
      where: { id: activeTimer.id },
    });

    return this.toActiveTimerResponse(activeTimer);
  }

  // ============================================
  // SHARED PRIVATE METHODS
  // ============================================

  private async createEntry(
    dto: CreateTimeEntryDto | AdminCreateTimeEntryDto,
    userId: string,
    companyId: string,
  ): Promise<TimeEntryResponse> {
    // Verify project belongs to company if provided
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, companyId },
      });

      if (!project) {
        throw new NotFoundException(
          `Proyecto con ID ${dto.projectId} no encontrado`,
        );
      }
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const durationMinutes =
      dto.durationMinutes ??
      Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    const timeEntry = await this.prisma.timeEntry.create({
      data: {
        userId,
        companyId,
        projectId: dto.projectId,
        startTime,
        endTime,
        durationMinutes: durationMinutes > 0 ? durationMinutes : 1,
        entryType: dto.entryType ?? 'WORK',
        source: dto.source ?? 'WEB',
        isManual: true,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return this.toTimeEntryResponse(timeEntry);
  }

  private async updateEntry(
    id: string,
    updateTimeEntryDto: UpdateTimeEntryDto,
    companyId: string,
  ): Promise<TimeEntryResponse> {
    // If updating projectId, verify it belongs to the company
    if (updateTimeEntryDto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: updateTimeEntryDto.projectId, companyId },
      });

      if (!project) {
        throw new NotFoundException(
          `Proyecto con ID ${updateTimeEntryDto.projectId} no encontrado`,
        );
      }
    }

    const timeEntry = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        projectId: updateTimeEntryDto.projectId,
        entryType: updateTimeEntryDto.entryType,
        startTime: updateTimeEntryDto.startTime
          ? new Date(updateTimeEntryDto.startTime)
          : undefined,
        endTime: updateTimeEntryDto.endTime
          ? new Date(updateTimeEntryDto.endTime)
          : undefined,
        durationMinutes: updateTimeEntryDto.durationMinutes,
        isModified: true,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return this.toTimeEntryResponse(timeEntry);
  }

  private toTimeEntryResponse(
    timeEntry: TimeEntry & {
      user?: { id: string; name: string; email: string };
      project?: { id: string; name: string; code: string | null } | null;
    },
  ): TimeEntryResponse {
    return {
      id: timeEntry.id,
      userId: timeEntry.userId,
      projectId: timeEntry.projectId,
      companyId: timeEntry.companyId,
      startTime: timeEntry.startTime,
      endTime: timeEntry.endTime,
      durationMinutes: timeEntry.durationMinutes,
      entryType: timeEntry.entryType,
      source: timeEntry.source,
      isManual: timeEntry.isManual,
      isModified: timeEntry.isModified,
      createdAt: timeEntry.createdAt,
      user: timeEntry.user,
      project: timeEntry.project,
    };
  }

  private toDeletedTimeEntryResponse(
    timeEntry: TimeEntry,
  ): DeletedTimeEntryResponse {
    return {
      id: timeEntry.id,
      userId: timeEntry.userId,
      projectId: timeEntry.projectId,
      companyId: timeEntry.companyId,
      startTime: timeEntry.startTime,
      endTime: timeEntry.endTime,
      durationMinutes: timeEntry.durationMinutes,
      entryType: timeEntry.entryType,
      createdAt: timeEntry.createdAt,
    };
  }

  private toActiveTimerResponse(
    activeTimer: ActiveTimer & {
      user?: { id: string; name: string; email: string };
      project?: { id: string; name: string; code: string | null } | null;
    },
  ): ActiveTimerResponse {
    return {
      id: activeTimer.id,
      userId: activeTimer.userId,
      projectId: activeTimer.projectId,
      companyId: activeTimer.companyId,
      startTime: activeTimer.startTime,
      entryType: activeTimer.entryType,
      user: activeTimer.user,
      project: activeTimer.project,
    };
  }
}
