import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Company, BillingPlan } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface CompanyResponse {
  id: string;
  name: string;
  cif: string | null;
  logoUrl: string | null;
  billingPlan: BillingPlan;
  allowUserEditSchedule: boolean;
  inviteCode: string | null;
  createdAt: Date;
}

export interface CompanyPublicResponse {
  id: string;
  name: string;
  logoUrl: string | null;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string): Promise<CompanyResponse> {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
    }

    return this.toCompanyResponse(company);
  }

  /**
   * Search companies by name (public - returns limited info)
   */
  async search(query: string): Promise<CompanyPublicResponse[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const companies = await this.prisma.company.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 10,
      orderBy: { name: 'asc' },
    });

    return companies.map((c) => this.toPublicResponse(c));
  }

  /**
   * Find company by invite code (public - returns limited info)
   */
  async findByInviteCode(code: string): Promise<CompanyPublicResponse> {
    const company = await this.prisma.company.findUnique({
      where: { inviteCode: code.toUpperCase() },
    });

    if (!company) {
      throw new NotFoundException('Código de invitación no válido');
    }

    return this.toPublicResponse(company);
  }

  /**
   * Generate or regenerate invite code for a company
   */
  async generateInviteCode(companyId: string): Promise<{ inviteCode: string }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Generate a unique 8-character code
    let inviteCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      inviteCode = randomBytes(4).toString('hex').toUpperCase();
      const existing = await this.prisma.company.findUnique({
        where: { inviteCode },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('No se pudo generar un código único');
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { inviteCode },
    });

    return { inviteCode };
  }

  /**
   * Remove invite code from a company (disable public joining)
   */
  async removeInviteCode(companyId: string): Promise<void> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: { inviteCode: null },
    });
  }

  private toCompanyResponse(company: Company): CompanyResponse {
    return {
      id: company.id,
      name: company.name,
      cif: company.cif,
      logoUrl: company.logoUrl,
      billingPlan: company.billingPlan,
      allowUserEditSchedule: company.allowUserEditSchedule,
      inviteCode: company.inviteCode,
      createdAt: company.createdAt,
    };
  }

  private toPublicResponse(company: Company): CompanyPublicResponse {
    return {
      id: company.id,
      name: company.name,
      logoUrl: company.logoUrl,
    };
  }
}
