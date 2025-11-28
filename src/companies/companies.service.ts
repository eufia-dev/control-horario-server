import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type company } from '../../generated/prisma/client.js';

export interface CompanyResponse {
  id: string;
  name: string;
  createdAt: Date;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CompanyResponse[]> {
    const companies = await this.prisma.company.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });

    return companies.map((company) => this.toCompanyResponse(company));
  }

  async findOne(id: string): Promise<CompanyResponse> {
    const company = await this.prisma.company.findUnique({
      where: { id },
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
      createdAt: company.created_at,
    };
  }
}
