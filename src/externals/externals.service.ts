import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateExternalDto } from './dto/create-external.dto.js';
import { CreateExternalHoursDto } from './dto/create-external-hours.dto.js';
import { UpdateExternalDto } from './dto/update-external.dto.js';
import { UpdateExternalHoursDto } from './dto/update-external-hours.dto.js';
import {
  type external,
  type external_hours,
} from '../../generated/prisma/client.js';

export interface ExternalResponse {
  id: string;
  name: string;
  hourlyCost: number;
  isActive: boolean;
  createdAt: Date;
  organizationId: string;
}

export interface DeletedExternalResponse {
  id: string;
  name: string;
  hourlyCost: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ExternalHoursResponse {
  id: string;
  externalId: string;
  projectId: string;
  organizationId: string;
  date: Date;
  minutes: number;
  createdAt: Date;
}

export interface DeletedExternalHoursResponse {
  id: string;
  externalId: string;
  projectId: string;
  date: Date;
  minutes: number;
  createdAt: Date;
}

@Injectable()
export class ExternalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<ExternalResponse[]> {
    const externals = await this.prisma.external.findMany({
      where: {
        organization_id: organizationId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return externals.map((external) => this.toExternalResponse(external));
  }

  async findOne(id: string, organizationId: string): Promise<ExternalResponse> {
    const external = await this.prisma.external.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!external) {
      throw new NotFoundException(`Externo con ID ${id} no encontrado`);
    }

    return this.toExternalResponse(external);
  }

  async create(
    createExternalDto: CreateExternalDto,
    organizationId: string,
  ): Promise<ExternalResponse> {
    const external = await this.prisma.external.create({
      data: {
        name: createExternalDto.name,
        hourly_cost: createExternalDto.hourlyCost,
        organization_id: organizationId,
      },
    });

    return this.toExternalResponse(external);
  }

  async update(
    id: string,
    updateExternalDto: UpdateExternalDto,
    organizationId: string,
  ): Promise<ExternalResponse> {
    // Verify the external belongs to the user's organization
    const existing = await this.prisma.external.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Externo con ID ${id} no encontrado`);
    }

    const external = await this.prisma.external.update({
      where: { id },
      data: {
        name: updateExternalDto.name,
        hourly_cost: updateExternalDto.hourlyCost,
        is_active: updateExternalDto.isActive,
      },
    });

    return this.toExternalResponse(external);
  }

  async remove(
    id: string,
    organizationId: string,
  ): Promise<DeletedExternalResponse> {
    const existing = await this.prisma.external.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Externo con ID ${id} no encontrado`);
    }

    const deleted = await this.prisma.external.delete({
      where: { id },
    });

    return this.toDeletedExternalResponse(deleted);
  }

  private toExternalResponse(external: external): ExternalResponse {
    return {
      id: external.id,
      name: external.name,
      hourlyCost: Number(external.hourly_cost),
      isActive: external.is_active,
      createdAt: external.created_at,
      organizationId: external.organization_id,
    };
  }

  private toDeletedExternalResponse(
    external: external,
  ): DeletedExternalResponse {
    return {
      id: external.id,
      name: external.name,
      hourlyCost: Number(external.hourly_cost),
      isActive: external.is_active,
      createdAt: external.created_at,
    };
  }

  // External Hours CRUD methods

  async findAllHours(
    externalId: string,
    organizationId: string,
  ): Promise<ExternalHoursResponse[]> {
    // Verify the external exists and belongs to the organization
    await this.findOne(externalId, organizationId);

    const hours = await this.prisma.external_hours.findMany({
      where: {
        external_id: externalId,
        organization_id: organizationId,
      },
      orderBy: {
        date: 'desc',
      },
    });

    return hours.map((h) => this.toExternalHoursResponse(h));
  }

  async findOneHours(
    id: string,
    externalId: string,
    organizationId: string,
  ): Promise<ExternalHoursResponse> {
    // Verify the external exists and belongs to the organization
    await this.findOne(externalId, organizationId);

    const hours = await this.prisma.external_hours.findFirst({
      where: {
        id,
        external_id: externalId,
        organization_id: organizationId,
      },
    });

    if (!hours) {
      throw new NotFoundException(`Horas con ID ${id} no encontradas`);
    }

    return this.toExternalHoursResponse(hours);
  }

  async createHours(
    externalId: string,
    dto: CreateExternalHoursDto,
    organizationId: string,
  ): Promise<ExternalHoursResponse> {
    // Verify the external exists and belongs to the organization
    await this.findOne(externalId, organizationId);

    const hours = await this.prisma.external_hours.create({
      data: {
        external_id: externalId,
        project_id: dto.projectId,
        organization_id: organizationId,
        date: dto.date,
        minutes: dto.minutes,
      },
    });

    return this.toExternalHoursResponse(hours);
  }

  async updateHours(
    id: string,
    externalId: string,
    dto: UpdateExternalHoursDto,
    organizationId: string,
  ): Promise<ExternalHoursResponse> {
    // Verify the external exists and belongs to the organization
    await this.findOne(externalId, organizationId);

    // Verify the hours entry exists
    const existing = await this.prisma.external_hours.findFirst({
      where: {
        id,
        external_id: externalId,
        organization_id: organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Horas con ID ${id} no encontradas`);
    }

    const hours = await this.prisma.external_hours.update({
      where: { id },
      data: {
        project_id: dto.projectId,
        date: dto.date,
        minutes: dto.minutes,
      },
    });

    return this.toExternalHoursResponse(hours);
  }

  async removeHours(
    id: string,
    externalId: string,
    organizationId: string,
  ): Promise<DeletedExternalHoursResponse> {
    // Verify the external exists and belongs to the organization
    await this.findOne(externalId, organizationId);

    const existing = await this.prisma.external_hours.findFirst({
      where: {
        id,
        external_id: externalId,
        organization_id: organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Horas con ID ${id} no encontradas`);
    }

    const deleted = await this.prisma.external_hours.delete({
      where: { id },
    });

    return this.toDeletedExternalHoursResponse(deleted);
  }

  private toExternalHoursResponse(
    hours: external_hours,
  ): ExternalHoursResponse {
    return {
      id: hours.id,
      externalId: hours.external_id,
      projectId: hours.project_id,
      organizationId: hours.organization_id,
      date: hours.date,
      minutes: hours.minutes,
      createdAt: hours.created_at,
    };
  }

  private toDeletedExternalHoursResponse(
    hours: external_hours,
  ): DeletedExternalHoursResponse {
    return {
      id: hours.id,
      externalId: hours.external_id,
      projectId: hours.project_id,
      date: hours.date,
      minutes: hours.minutes,
      createdAt: hours.created_at,
    };
  }
}
