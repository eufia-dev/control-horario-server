import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProviderDto } from './dto/create-provider.dto.js';
import type { UpdateProviderDto } from './dto/update-provider.dto.js';
import type { Provider } from '@prisma/client';

export interface ProviderResponse {
  id: string;
  name: string;
  paymentPeriod: number; // Payment period in days
  createdAt: Date;
}

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string): Promise<ProviderResponse[]> {
    const providers = await this.prisma.provider.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    return providers.map((p) => this.toProviderResponse(p));
  }

  async findOne(id: string, companyId: string): Promise<ProviderResponse> {
    const provider = await this.prisma.provider.findFirst({
      where: { id, companyId },
    });

    if (!provider) {
      throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
    }

    return this.toProviderResponse(provider);
  }

  async create(
    dto: CreateProviderDto,
    companyId: string,
  ): Promise<ProviderResponse> {
    // Check if provider name already exists in this company
    const existing = await this.prisma.provider.findFirst({
      where: {
        companyId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un proveedor con el nombre "${dto.name}"`,
      );
    }

    const provider = await this.prisma.provider.create({
      data: {
        name: dto.name,
        paymentPeriod: dto.paymentPeriod,
        companyId,
      },
    });

    return this.toProviderResponse(provider);
  }

  async update(
    id: string,
    dto: UpdateProviderDto,
    companyId: string,
  ): Promise<ProviderResponse> {
    const existing = await this.prisma.provider.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
    }

    // Check if new name conflicts with another provider
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.provider.findFirst({
        where: {
          companyId,
          name: dto.name,
          id: { not: id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Ya existe un proveedor con el nombre "${dto.name}"`,
        );
      }
    }

    const provider = await this.prisma.provider.update({
      where: { id },
      data: {
        name: dto.name,
        paymentPeriod: dto.paymentPeriod,
      },
    });

    return this.toProviderResponse(provider);
  }

  async remove(id: string, companyId: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.provider.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
    }

    // Check if provider is in use by any cost estimates or actuals
    const [estimatesCount, actualsCount] = await Promise.all([
      this.prisma.projectExternalCostEstimate.count({
        where: { providerId: id },
      }),
      this.prisma.projectExternalCostActual.count({
        where: { providerId: id },
      }),
    ]);

    if (estimatesCount > 0 || actualsCount > 0) {
      throw new ConflictException(
        `No se puede eliminar el proveedor porque está siendo utilizado en ${estimatesCount + actualsCount} registro(s) de costes`,
      );
    }

    await this.prisma.provider.delete({
      where: { id },
    });

    return { success: true };
  }

  private toProviderResponse(provider: Provider): ProviderResponse {
    return {
      id: provider.id,
      name: provider.name,
      paymentPeriod: provider.paymentPeriod,
      createdAt: provider.createdAt,
    };
  }
}
