import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type company } from '../../generated/prisma/client.js';

export interface CompanyResponse {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<CompanyResponse[]> {
    const companies = await this.prisma.company.findMany({
      where: {
        organization_id: organizationId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return companies.map((company) => this.toCompanyResponse(company));
  }

  async findOne(id: string, organizationId: string): Promise<CompanyResponse> {
    const company = await this.prisma.company.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!company) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
    }

    return this.toCompanyResponse(company);
  }

  private toCompanyResponse(company: company): CompanyResponse {
    return {
      id: company.id,
      name: company.name,
      organizationId: company.organization_id,
      createdAt: company.created_at,
    };
  }
}
