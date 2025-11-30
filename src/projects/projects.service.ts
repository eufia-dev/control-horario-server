import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { type project } from '../../generated/prisma/client.js';

export interface ProjectResponse {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
  companyId: string;
  companyName: string;
}

export interface DeletedProjectResponse {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<ProjectResponse[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        company: {
          organization_id: organizationId,
        },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return projects.map((project) => this.toProjectResponse(project));
  }

  async findOne(id: string, organizationId: string): Promise<ProjectResponse> {
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        company: {
          organization_id: organizationId,
        },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    return this.toProjectResponse(project);
  }

  async create(
    createProjectDto: CreateProjectDto,
    organizationId: string,
  ): Promise<ProjectResponse> {
    // Verify the company belongs to the user's organization
    const company = await this.prisma.company.findFirst({
      where: {
        id: createProjectDto.companyId,
        organization_id: organizationId,
      },
    });

    if (!company) {
      throw new NotFoundException(
        `Empresa con ID ${createProjectDto.companyId} no encontrada`,
      );
    }

    const project = await this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        code: createProjectDto.code,
        company_id: createProjectDto.companyId,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return this.toProjectResponse(project);
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    organizationId: string,
  ): Promise<ProjectResponse> {
    // Verify the project belongs to the user's organization
    const existing = await this.prisma.project.findFirst({
      where: {
        id,
        company: {
          organization_id: organizationId,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    // If changing company, verify the new company belongs to the same organization
    if (updateProjectDto.companyId) {
      const company = await this.prisma.company.findFirst({
        where: {
          id: updateProjectDto.companyId,
          organization_id: organizationId,
        },
      });

      if (!company) {
        throw new NotFoundException(
          `Empresa con ID ${updateProjectDto.companyId} no encontrada`,
        );
      }
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: updateProjectDto.name,
        code: updateProjectDto.code,
        company_id: updateProjectDto.companyId,
        is_active: updateProjectDto.isActive,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return this.toProjectResponse(project);
  }

  async remove(
    id: string,
    organizationId: string,
  ): Promise<DeletedProjectResponse> {
    const existing = await this.prisma.project.findFirst({
      where: {
        id,
        company: {
          organization_id: organizationId,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    const deleted = await this.prisma.project.delete({
      where: { id },
    });

    return this.toDeletedProjectResponse(deleted);
  }

  private toProjectResponse(
    project: project & { company: { id: string; name: string } },
  ): ProjectResponse {
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      isActive: project.is_active,
      createdAt: project.created_at,
      companyId: project.company.id,
      companyName: project.company.name,
    };
  }

  private toDeletedProjectResponse(project: project): DeletedProjectResponse {
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      isActive: project.is_active,
      createdAt: project.created_at,
    };
  }
}
