import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateExternalDto } from './dto/create-external.dto.js';
import { CreateExternalHoursDto } from './dto/create-external-hours.dto.js';
import { UpdateExternalDto } from './dto/update-external.dto.js';
import { UpdateExternalHoursDto } from './dto/update-external-hours.dto.js';
import type { ExternalWorker, ExternalHours } from '@prisma/client';

export interface ExternalWorkerResponse {
  id: string;
  name: string;
  hourlyCost: number;
  isActive: boolean;
  companyId: string;
  createdAt: Date;
}

export interface DeletedExternalWorkerResponse {
  id: string;
  name: string;
  hourlyCost: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ExternalHoursResponse {
  id: string;
  externalWorkerId: string;
  projectId: string;
  companyId: string;
  date: Date;
  minutes: number;
  cost: number;
  createdAt: Date;
}

export interface DeletedExternalHoursResponse {
  id: string;
  externalWorkerId: string;
  projectId: string;
  date: Date;
  minutes: number;
  createdAt: Date;
}

@Injectable()
export class ExternalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string): Promise<ExternalWorkerResponse[]> {
    const externals = await this.prisma.externalWorker.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return externals.map((external) => this.toExternalWorkerResponse(external));
  }

  async findOne(
    id: string,
    companyId: string,
  ): Promise<ExternalWorkerResponse> {
    const external = await this.prisma.externalWorker.findFirst({
      where: { id, companyId },
    });

    if (!external) {
      throw new NotFoundException(`Externo con ID ${id} no encontrado`);
    }

    return this.toExternalWorkerResponse(external);
  }

  async create(
    createExternalDto: CreateExternalDto,
    companyId: string,
  ): Promise<ExternalWorkerResponse> {
    const external = await this.prisma.externalWorker.create({
      data: {
        name: createExternalDto.name,
        hourlyCost: createExternalDto.hourlyCost,
        companyId,
      },
    });

    return this.toExternalWorkerResponse(external);
  }

  async update(
    id: string,
    updateExternalDto: UpdateExternalDto,
    companyId: string,
  ): Promise<ExternalWorkerResponse> {
    // Verify the external belongs to the company
    const existing = await this.prisma.externalWorker.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Externo con ID ${id} no encontrado`);
    }

    const external = await this.prisma.externalWorker.update({
      where: { id },
      data: {
        name: updateExternalDto.name,
        hourlyCost: updateExternalDto.hourlyCost
          ? updateExternalDto.hourlyCost
          : undefined,
        isActive: updateExternalDto.isActive,
      },
    });

    return this.toExternalWorkerResponse(external);
  }

  async remove(
    id: string,
    companyId: string,
  ): Promise<DeletedExternalWorkerResponse> {
    const existing = await this.prisma.externalWorker.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Externo con ID ${id} no encontrado`);
    }

    const deleted = await this.prisma.externalWorker.delete({
      where: { id },
    });

    return this.toDeletedExternalWorkerResponse(deleted);
  }

  private toExternalWorkerResponse(
    external: ExternalWorker,
  ): ExternalWorkerResponse {
    return {
      id: external.id,
      name: external.name,
      hourlyCost: Number(external.hourlyCost),
      isActive: external.isActive,
      companyId: external.companyId,
      createdAt: external.createdAt,
    };
  }

  private toDeletedExternalWorkerResponse(
    external: ExternalWorker,
  ): DeletedExternalWorkerResponse {
    return {
      id: external.id,
      name: external.name,
      hourlyCost: Number(external.hourlyCost),
      isActive: external.isActive,
      createdAt: external.createdAt,
    };
  }

  // External Hours CRUD methods

  async findAllHours(
    externalWorkerId: string,
    companyId: string,
  ): Promise<ExternalHoursResponse[]> {
    // Verify the external exists and belongs to the company
    await this.findOne(externalWorkerId, companyId);

    const hours = await this.prisma.externalHours.findMany({
      where: {
        externalWorkerId,
        companyId,
      },
      orderBy: { date: 'desc' },
    });

    return hours.map((h) => this.toExternalHoursResponse(h));
  }

  async findOneHours(
    id: string,
    externalWorkerId: string,
    companyId: string,
  ): Promise<ExternalHoursResponse> {
    // Verify the external exists and belongs to the company
    await this.findOne(externalWorkerId, companyId);

    const hours = await this.prisma.externalHours.findFirst({
      where: {
        id,
        externalWorkerId,
        companyId,
      },
    });

    if (!hours) {
      throw new NotFoundException(`Horas con ID ${id} no encontradas`);
    }

    return this.toExternalHoursResponse(hours);
  }

  async createHours(
    externalWorkerId: string,
    dto: CreateExternalHoursDto,
    companyId: string,
  ): Promise<ExternalHoursResponse> {
    // Verify the external exists and belongs to the company
    const external = await this.findOne(externalWorkerId, companyId);

    // Calculate cost based on external's hourly rate
    const cost = (dto.minutes / 60) * external.hourlyCost;

    const hours = await this.prisma.externalHours.create({
      data: {
        externalWorkerId,
        projectId: dto.projectId,
        companyId,
        date: new Date(dto.date),
        minutes: dto.minutes,
        cost,
      },
    });

    return this.toExternalHoursResponse(hours);
  }

  async updateHours(
    id: string,
    externalWorkerId: string,
    dto: UpdateExternalHoursDto,
    companyId: string,
  ): Promise<ExternalHoursResponse> {
    // Verify the external exists and belongs to the company
    const external = await this.findOne(externalWorkerId, companyId);

    // Verify the hours entry exists
    const existing = await this.prisma.externalHours.findFirst({
      where: {
        id,
        externalWorkerId,
        companyId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Horas con ID ${id} no encontradas`);
    }

    // Recalculate cost if minutes changed
    const minutes = dto.minutes ?? existing.minutes;
    const cost = (minutes / 60) * external.hourlyCost;

    const hours = await this.prisma.externalHours.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        date: dto.date ? new Date(dto.date) : undefined,
        minutes: dto.minutes,
        cost,
      },
    });

    return this.toExternalHoursResponse(hours);
  }

  async removeHours(
    id: string,
    externalWorkerId: string,
    companyId: string,
  ): Promise<DeletedExternalHoursResponse> {
    // Verify the external exists and belongs to the company
    await this.findOne(externalWorkerId, companyId);

    const existing = await this.prisma.externalHours.findFirst({
      where: {
        id,
        externalWorkerId,
        companyId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Horas con ID ${id} no encontradas`);
    }

    const deleted = await this.prisma.externalHours.delete({
      where: { id },
    });

    return this.toDeletedExternalHoursResponse(deleted);
  }

  private toExternalHoursResponse(hours: ExternalHours): ExternalHoursResponse {
    return {
      id: hours.id,
      externalWorkerId: hours.externalWorkerId,
      projectId: hours.projectId,
      companyId: hours.companyId,
      date: hours.date,
      minutes: hours.minutes,
      cost: Number(hours.cost),
      createdAt: hours.createdAt,
    };
  }

  private toDeletedExternalHoursResponse(
    hours: ExternalHours,
  ): DeletedExternalHoursResponse {
    return {
      id: hours.id,
      externalWorkerId: hours.externalWorkerId,
      projectId: hours.projectId,
      date: hours.date,
      minutes: hours.minutes,
      createdAt: hours.createdAt,
    };
  }
}
