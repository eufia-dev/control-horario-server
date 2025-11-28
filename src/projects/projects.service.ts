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
  company: string;
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

  async findAll(): Promise<ProjectResponse[]> {
    const projects = await this.prisma.project.findMany({
      include: {
        company: {
          select: {
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

  async findOne(id: string): Promise<ProjectResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        company: {
          select: {
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

  async create(createProjectDto: CreateProjectDto): Promise<ProjectResponse> {
    const project = await this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        code: createProjectDto.code,
        company_id: createProjectDto.companyId,
      },
      include: {
        company: {
          select: {
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
  ): Promise<ProjectResponse> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
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
            name: true,
          },
        },
      },
    });

    return this.toProjectResponse(project);
  }

  async remove(id: string): Promise<DeletedProjectResponse> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    const deleted = await this.prisma.project.delete({
      where: { id },
    });

    return this.toDeletedProjectResponse(deleted);
  }

  private toProjectResponse(
    project: project & { company: { name: string } },
  ): ProjectResponse {
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      isActive: project.is_active,
      createdAt: project.created_at,
      company: project.company.name,
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
