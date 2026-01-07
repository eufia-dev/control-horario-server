import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import type { Project } from '@prisma/client';

export interface ProjectResponse {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  companyId: string;
  categoryId: string | null;
  createdAt: Date;
}

export interface DeletedProjectResponse {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string): Promise<ProjectResponse[]> {
    const projects = await this.prisma.project.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    return projects.map((project) => this.toProjectResponse(project));
  }

  async findOne(id: string, companyId: string): Promise<ProjectResponse> {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    return this.toProjectResponse(project);
  }

  async create(
    createProjectDto: CreateProjectDto,
    companyId: string,
  ): Promise<ProjectResponse> {
    const project = await this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        code: createProjectDto.code,
        companyId,
        categoryId: createProjectDto.categoryId,
      },
    });

    return this.toProjectResponse(project);
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    companyId: string,
  ): Promise<ProjectResponse> {
    // Verify the project belongs to the company
    const existing = await this.prisma.project.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: updateProjectDto.name,
        code: updateProjectDto.code,
        isActive: updateProjectDto.isActive,
        categoryId: updateProjectDto.categoryId,
      },
    });

    return this.toProjectResponse(project);
  }

  async remove(id: string, companyId: string): Promise<DeletedProjectResponse> {
    const existing = await this.prisma.project.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    const deleted = await this.prisma.project.delete({
      where: { id },
    });

    return this.toDeletedProjectResponse(deleted);
  }

  private toProjectResponse(project: Project): ProjectResponse {
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      isActive: project.isActive,
      companyId: project.companyId,
      categoryId: project.categoryId,
      createdAt: project.createdAt,
    };
  }

  private toDeletedProjectResponse(project: Project): DeletedProjectResponse {
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      isActive: project.isActive,
      createdAt: project.createdAt,
    };
  }
}
