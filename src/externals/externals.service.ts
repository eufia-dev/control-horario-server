import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateExternalDto } from './dto/create-external.dto.js';
import { UpdateExternalDto } from './dto/update-external.dto.js';
import { type external } from '../../generated/prisma/client.js';

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
}
