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
import {
  type time_entry,
  type active_timer,
} from '../../generated/prisma/client.js';

export interface TimeEntryResponse {
  id: string;
  userId: string;
  projectId: string;
  organizationId: string;
  typeId: string;
  startedAt: Date;
  endedAt: Date;
  minutes: number;
  isOffice: boolean;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
    code: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  timeEntryType?: {
    id: string;
    name: string;
  };
}

export interface DeletedTimeEntryResponse {
  id: string;
  userId: string;
  projectId: string;
  organizationId: string;
  typeId: string;
  startedAt: Date;
  endedAt: Date;
  minutes: number;
  isOffice: boolean;
  createdAt: Date;
}

export interface ActiveTimerResponse {
  id: string;
  userId: string;
  projectId: string;
  organizationId: string;
  typeId: string;
  startedAt: Date;
  isOffice: boolean;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
    code: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  timeEntryType?: {
    id: string;
    name: string;
  };
}

export interface SwitchTimerResponse {
  stoppedEntry: TimeEntryResponse;
  activeTimer: ActiveTimerResponse;
}

export interface TimeEntryTypeResponse {
  id: string;
  name: string;
  createdAt: Date;
}

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // TIME ENTRY TYPES
  // ============================================

  async findAllTypes(): Promise<TimeEntryTypeResponse[]> {
    const types = await this.prisma.time_entry_type.findMany({
      orderBy: { name: 'asc' },
    });

    return types.map((type) => ({
      id: type.id,
      name: type.name,
      createdAt: type.created_at,
    }));
  }

  // ============================================
  // ADMIN METHODS (no ownership checks needed)
  // ============================================

  async findAll(
    organizationId: string,
    userId?: string,
  ): Promise<TimeEntryResponse[]> {
    const whereClause: Record<string, unknown> = {
      user: {
        organization_id: organizationId,
      },
    };

    if (userId) {
      whereClause.user_id = userId;
    }

    const timeEntries = await this.prisma.time_entry.findMany({
      where: whereClause,
      include: {
        user: true,
        project: true,
        organization: true,
        time_entry_type: true,
      },
      orderBy: {
        started_at: 'desc',
      },
    });

    return timeEntries.map((entry) => this.toTimeEntryResponse(entry));
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<TimeEntryResponse> {
    const timeEntry = await this.prisma.time_entry.findFirst({
      where: {
        id,
        user: {
          organization_id: organizationId,
        },
      },
      include: {
        user: true,
        project: true,
        organization: true,
        time_entry_type: true,
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
    organizationId: string,
  ): Promise<TimeEntryResponse> {
    // Verify the user belongs to the organization
    const user = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        organization_id: organizationId,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${dto.userId} no encontrado`);
    }

    return this.createEntry(dto, dto.userId, organizationId);
  }

  async update(
    id: string,
    updateTimeEntryDto: UpdateTimeEntryDto,
    organizationId: string,
  ): Promise<TimeEntryResponse> {
    const existing = await this.prisma.time_entry.findFirst({
      where: {
        id,
        user: {
          organization_id: organizationId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    return this.updateEntry(id, updateTimeEntryDto, organizationId);
  }

  async remove(
    id: string,
    organizationId: string,
  ): Promise<DeletedTimeEntryResponse> {
    const existing = await this.prisma.time_entry.findFirst({
      where: {
        id,
        user: {
          organization_id: organizationId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    const deleted = await this.prisma.time_entry.delete({
      where: { id },
    });

    return this.toDeletedTimeEntryResponse(deleted);
  }

  // ============================================
  // USER METHODS (scoped to current user)
  // ============================================

  async findMyEntries(
    userId: string,
    organizationId: string,
  ): Promise<TimeEntryResponse[]> {
    const timeEntries = await this.prisma.time_entry.findMany({
      where: {
        user_id: userId,
        user: {
          organization_id: organizationId,
        },
      },
      include: {
        user: true,
        project: true,
        organization: true,
        time_entry_type: true,
      },
      orderBy: {
        started_at: 'desc',
      },
    });

    return timeEntries.map((entry) => this.toTimeEntryResponse(entry));
  }

  async findMyOne(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<TimeEntryResponse> {
    const timeEntry = await this.prisma.time_entry.findFirst({
      where: {
        id,
        user_id: userId,
        user: {
          organization_id: organizationId,
        },
      },
      include: {
        user: true,
        project: true,
        organization: true,
        time_entry_type: true,
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
    organizationId: string,
  ): Promise<TimeEntryResponse> {
    return this.createEntry(createTimeEntryDto, userId, organizationId);
  }

  async updateMine(
    id: string,
    updateTimeEntryDto: UpdateTimeEntryDto,
    userId: string,
    organizationId: string,
  ): Promise<TimeEntryResponse> {
    const existing = await this.prisma.time_entry.findFirst({
      where: {
        id,
        user_id: userId,
        user: {
          organization_id: organizationId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    return this.updateEntry(id, updateTimeEntryDto, organizationId);
  }

  async removeMine(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<DeletedTimeEntryResponse> {
    const existing = await this.prisma.time_entry.findFirst({
      where: {
        id,
        user_id: userId,
        user: {
          organization_id: organizationId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de tiempo con ID ${id} no encontrado`,
      );
    }

    const deleted = await this.prisma.time_entry.delete({
      where: { id },
    });

    return this.toDeletedTimeEntryResponse(deleted);
  }

  // ============================================
  // TIMER METHODS (start, stop, switch)
  // ============================================

  async getActiveTimer(
    userId: string,
    organizationId: string,
  ): Promise<ActiveTimerResponse | null> {
    const activeTimer = await this.prisma.active_timer.findFirst({
      where: {
        user_id: userId,
        user: {
          organization_id: organizationId,
        },
      },
      include: {
        user: true,
        project: true,
        organization: true,
        time_entry_type: true,
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
    organizationId: string,
  ): Promise<ActiveTimerResponse> {
    // Check if user already has an active timer
    const existingTimer = await this.prisma.active_timer.findUnique({
      where: { user_id: userId },
    });

    if (existingTimer) {
      throw new ConflictException(
        'Ya tienes un temporizador activo. Debes detenerlo antes de iniciar uno nuevo.',
      );
    }

    // Verify project belongs to organization
    const project = await this.prisma.project.findFirst({
      where: {
        id: dto.projectId,
        company: {
          organization_id: organizationId,
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Proyecto con ID ${dto.projectId} no encontrado`,
      );
    }

    // Verify time entry type exists
    const timeEntryType = await this.prisma.time_entry_type.findFirst({
      where: { id: dto.typeId },
    });

    if (!timeEntryType) {
      throw new NotFoundException(
        `Tipo de registro con ID ${dto.typeId} no encontrado`,
      );
    }

    const activeTimer = await this.prisma.active_timer.create({
      data: {
        user_id: userId,
        project_id: dto.projectId,
        organization_id: organizationId,
        type_id: dto.typeId,
        started_at: new Date(),
        is_office: dto.isOffice ?? true,
      },
      include: {
        user: true,
        project: true,
        organization: true,
        time_entry_type: true,
      },
    });

    return this.toActiveTimerResponse(activeTimer);
  }

  async stopTimer(
    userId: string,
    organizationId: string,
  ): Promise<TimeEntryResponse> {
    const activeTimer = await this.prisma.active_timer.findFirst({
      where: {
        user_id: userId,
        user: {
          organization_id: organizationId,
        },
      },
    });

    if (!activeTimer) {
      throw new NotFoundException('No tienes ningún temporizador activo');
    }

    const endedAt = new Date();
    const minutes = Math.round(
      (endedAt.getTime() - activeTimer.started_at.getTime()) / 60000,
    );

    // Use a transaction to ensure atomicity
    const [, timeEntry] = await this.prisma.$transaction([
      this.prisma.active_timer.delete({
        where: { id: activeTimer.id },
      }),
      this.prisma.time_entry.create({
        data: {
          user_id: activeTimer.user_id,
          project_id: activeTimer.project_id,
          organization_id: activeTimer.organization_id,
          type_id: activeTimer.type_id,
          started_at: activeTimer.started_at,
          ended_at: endedAt,
          minutes: minutes > 0 ? minutes : 1, // At least 1 minute
          is_office: activeTimer.is_office,
        },
        include: {
          user: true,
          project: true,
          organization: true,
          time_entry_type: true,
        },
      }),
    ]);

    return this.toTimeEntryResponse(timeEntry);
  }

  async switchTimer(
    dto: SwitchTimerDto,
    userId: string,
    organizationId: string,
  ): Promise<SwitchTimerResponse> {
    const activeTimer = await this.prisma.active_timer.findFirst({
      where: {
        user_id: userId,
        user: {
          organization_id: organizationId,
        },
      },
    });

    if (!activeTimer) {
      throw new NotFoundException(
        'No tienes ningún temporizador activo para cambiar',
      );
    }

    // Verify new project belongs to organization
    const project = await this.prisma.project.findFirst({
      where: {
        id: dto.projectId,
        company: {
          organization_id: organizationId,
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Proyecto con ID ${dto.projectId} no encontrado`,
      );
    }

    // Verify time entry type exists
    const timeEntryType = await this.prisma.time_entry_type.findFirst({
      where: { id: dto.typeId },
    });

    if (!timeEntryType) {
      throw new NotFoundException(
        `Tipo de registro con ID ${dto.typeId} no encontrado`,
      );
    }

    const switchTime = new Date();
    const minutes = Math.round(
      (switchTime.getTime() - activeTimer.started_at.getTime()) / 60000,
    );

    // Use a transaction: delete old timer, create time entry, create new timer
    const [, timeEntry, newActiveTimer] = await this.prisma.$transaction([
      this.prisma.active_timer.delete({
        where: { id: activeTimer.id },
      }),
      this.prisma.time_entry.create({
        data: {
          user_id: activeTimer.user_id,
          project_id: activeTimer.project_id,
          organization_id: activeTimer.organization_id,
          type_id: activeTimer.type_id,
          started_at: activeTimer.started_at,
          ended_at: switchTime,
          minutes: minutes > 0 ? minutes : 1,
          is_office: activeTimer.is_office,
        },
        include: {
          user: true,
          project: true,
          organization: true,
          time_entry_type: true,
        },
      }),
      this.prisma.active_timer.create({
        data: {
          user_id: userId,
          project_id: dto.projectId,
          organization_id: organizationId,
          type_id: dto.typeId,
          started_at: switchTime,
          is_office: dto.isOffice ?? true,
        },
        include: {
          user: true,
          project: true,
          organization: true,
          time_entry_type: true,
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
    organizationId: string,
  ): Promise<ActiveTimerResponse> {
    const activeTimer = await this.prisma.active_timer.findFirst({
      where: {
        user_id: userId,
        user: {
          organization_id: organizationId,
        },
      },
      include: {
        user: true,
        project: true,
        organization: true,
        time_entry_type: true,
      },
    });

    if (!activeTimer) {
      throw new NotFoundException('No tienes ningún temporizador activo');
    }

    await this.prisma.active_timer.delete({
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
    organizationId: string,
  ): Promise<TimeEntryResponse> {
    // Verify that the project belongs to a company in the organization
    const project = await this.prisma.project.findFirst({
      where: {
        id: dto.projectId,
        company: {
          organization_id: organizationId,
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Proyecto con ID ${dto.projectId} no encontrado`,
      );
    }

    // Verify the time entry type exists
    const timeEntryType = await this.prisma.time_entry_type.findFirst({
      where: {
        id: dto.typeId,
      },
    });

    if (!timeEntryType) {
      throw new NotFoundException(
        `Tipo de registro con ID ${dto.typeId} no encontrado`,
      );
    }

    const timeEntry = await this.prisma.time_entry.create({
      data: {
        user_id: userId,
        project_id: dto.projectId,
        organization_id: organizationId,
        type_id: dto.typeId,
        started_at: new Date(dto.startedAt),
        ended_at: new Date(dto.endedAt),
        minutes: dto.minutes,
        is_office: dto.isOffice ?? true,
      },
      include: {
        user: true,
        project: true,
        organization: true,
        time_entry_type: true,
      },
    });

    return this.toTimeEntryResponse(timeEntry);
  }

  private async updateEntry(
    id: string,
    updateTimeEntryDto: UpdateTimeEntryDto,
    organizationId: string,
  ): Promise<TimeEntryResponse> {
    // If updating projectId, verify it belongs to the organization
    if (updateTimeEntryDto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: updateTimeEntryDto.projectId,
          company: {
            organization_id: organizationId,
          },
        },
      });

      if (!project) {
        throw new NotFoundException(
          `Proyecto con ID ${updateTimeEntryDto.projectId} no encontrado`,
        );
      }
    }

    // If updating typeId, verify it exists
    if (updateTimeEntryDto.typeId) {
      const timeEntryType = await this.prisma.time_entry_type.findFirst({
        where: {
          id: updateTimeEntryDto.typeId,
        },
      });

      if (!timeEntryType) {
        throw new NotFoundException(
          `Tipo de registro con ID ${updateTimeEntryDto.typeId} no encontrado`,
        );
      }
    }

    const timeEntry = await this.prisma.time_entry.update({
      where: { id },
      data: {
        project_id: updateTimeEntryDto.projectId,
        type_id: updateTimeEntryDto.typeId,
        started_at: updateTimeEntryDto.startedAt
          ? new Date(updateTimeEntryDto.startedAt)
          : undefined,
        ended_at: updateTimeEntryDto.endedAt
          ? new Date(updateTimeEntryDto.endedAt)
          : undefined,
        minutes: updateTimeEntryDto.minutes,
        is_office: updateTimeEntryDto.isOffice,
      },
      include: {
        user: true,
        project: true,
        organization: true,
        time_entry_type: true,
      },
    });

    return this.toTimeEntryResponse(timeEntry);
  }

  private toTimeEntryResponse(
    timeEntry: time_entry & {
      user?: { id: string; name: string; email: string };
      project?: { id: string; name: string; code: string };
      organization?: { id: string; name: string };
      time_entry_type?: { id: string; name: string };
    },
  ): TimeEntryResponse {
    return {
      id: timeEntry.id,
      userId: timeEntry.user_id,
      projectId: timeEntry.project_id,
      organizationId: timeEntry.organization_id,
      typeId: timeEntry.type_id,
      startedAt: timeEntry.started_at,
      endedAt: timeEntry.ended_at,
      minutes: timeEntry.minutes,
      isOffice: timeEntry.is_office,
      createdAt: timeEntry.created_at,
      user: timeEntry.user
        ? {
            id: timeEntry.user.id,
            name: timeEntry.user.name,
            email: timeEntry.user.email,
          }
        : undefined,
      project: timeEntry.project
        ? {
            id: timeEntry.project.id,
            name: timeEntry.project.name,
            code: timeEntry.project.code,
          }
        : undefined,
      organization: timeEntry.organization
        ? {
            id: timeEntry.organization.id,
            name: timeEntry.organization.name,
          }
        : undefined,
      timeEntryType: timeEntry.time_entry_type
        ? {
            id: timeEntry.time_entry_type.id,
            name: timeEntry.time_entry_type.name,
          }
        : undefined,
    };
  }

  private toDeletedTimeEntryResponse(
    timeEntry: time_entry,
  ): DeletedTimeEntryResponse {
    return {
      id: timeEntry.id,
      userId: timeEntry.user_id,
      projectId: timeEntry.project_id,
      organizationId: timeEntry.organization_id,
      typeId: timeEntry.type_id,
      startedAt: timeEntry.started_at,
      endedAt: timeEntry.ended_at,
      minutes: timeEntry.minutes,
      isOffice: timeEntry.is_office,
      createdAt: timeEntry.created_at,
    };
  }

  private toActiveTimerResponse(
    activeTimer: active_timer & {
      user?: { id: string; name: string; email: string };
      project?: { id: string; name: string; code: string };
      organization?: { id: string; name: string };
      time_entry_type?: { id: string; name: string };
    },
  ): ActiveTimerResponse {
    return {
      id: activeTimer.id,
      userId: activeTimer.user_id,
      projectId: activeTimer.project_id,
      organizationId: activeTimer.organization_id,
      typeId: activeTimer.type_id,
      startedAt: activeTimer.started_at,
      isOffice: activeTimer.is_office,
      createdAt: activeTimer.created_at,
      user: activeTimer.user
        ? {
            id: activeTimer.user.id,
            name: activeTimer.user.name,
            email: activeTimer.user.email,
          }
        : undefined,
      project: activeTimer.project
        ? {
            id: activeTimer.project.id,
            name: activeTimer.project.name,
            code: activeTimer.project.code,
          }
        : undefined,
      organization: activeTimer.organization
        ? {
            id: activeTimer.organization.id,
            name: activeTimer.organization.name,
          }
        : undefined,
      timeEntryType: activeTimer.time_entry_type
        ? {
            id: activeTimer.time_entry_type.id,
            name: activeTimer.time_entry_type.name,
          }
        : undefined,
    };
  }
}
