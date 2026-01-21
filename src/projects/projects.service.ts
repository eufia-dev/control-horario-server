import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { CreateProjectCategoryDto } from './dto/create-project-category.dto.js';
import { UpdateProjectCategoryDto } from './dto/update-project-category.dto.js';
import type { Project, ProjectCategory } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';

export interface ProjectTeamInfo {
  id: string;
  name: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  companyId: string;
  categoryId: string | null;
  teamId: string | null;
  team: ProjectTeamInfo | null;
  delegation: string | null;
  clientName: string | null;
  createdAt: Date;
}

export interface DeletedProjectResponse {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface ProjectCategoryResponse {
  id: string;
  name: string;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string): Promise<ProjectResponse[]> {
    const projects = await this.prisma.project.findMany({
      where: { companyId },
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return projects.map((project) => this.toProjectResponse(project));
  }

  async findOne(id: string, companyId: string): Promise<ProjectResponse> {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId },
      include: {
        team: {
          select: { id: true, name: true },
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
    companyId: string,
    user: JwtPayload,
  ): Promise<ProjectResponse> {
    // Determine teamId based on user role:
    // - TEAM_LEADER: automatically use their teamId (cannot create company-wide projects)
    // - ADMIN/OWNER: can specify teamId or leave null for company-wide
    let teamId: string | null = null;

    if (user.role === 'TEAM_LEADER') {
      if (!user.teamId) {
        throw new ForbiddenException(
          'Debes pertenecer a un equipo para crear proyectos',
        );
      }
      teamId = user.teamId; // Always assign to their team
    } else {
      // Admin can optionally assign to a team
      teamId = createProjectDto.teamId || null;
    }

    const project = await this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        code: createProjectDto.code,
        companyId,
        categoryId: createProjectDto.categoryId,
        teamId,
        delegation: createProjectDto.delegation,
        clientName: createProjectDto.clientName,
      },
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
    });

    return this.toProjectResponse(project);
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    companyId: string,
    user: JwtPayload,
  ): Promise<ProjectResponse> {
    // Verify the project belongs to the company
    const existing = await this.prisma.project.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    // Authorization check for TEAM_LEADER
    if (user.role === 'TEAM_LEADER') {
      // Can only edit projects belonging to their team
      if (!existing.teamId || existing.teamId !== user.teamId) {
        throw new ForbiddenException(
          'Solo puedes editar proyectos de tu equipo',
        );
      }
    }

    // Determine teamId for update
    let teamId: string | null | undefined = undefined;
    if (user.role === 'TEAM_LEADER') {
      // TEAM_LEADER cannot change teamId - projects stay in their team
      teamId = undefined;
    } else if (updateProjectDto.teamId !== undefined) {
      // Admin/Owner can set or clear teamId
      teamId = updateProjectDto.teamId;
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: updateProjectDto.name,
        code: updateProjectDto.code,
        isActive: updateProjectDto.isActive,
        categoryId: updateProjectDto.categoryId,
        delegation: updateProjectDto.delegation,
        clientName: updateProjectDto.clientName,
        ...(teamId !== undefined && { teamId }),
      },
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
    });

    return this.toProjectResponse(project);
  }

  async remove(
    id: string,
    companyId: string,
    user: JwtPayload,
  ): Promise<DeletedProjectResponse> {
    const existing = await this.prisma.project.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    // Authorization check for TEAM_LEADER
    if (user.role === 'TEAM_LEADER') {
      // Can only delete projects belonging to their team
      if (!existing.teamId || existing.teamId !== user.teamId) {
        throw new ForbiddenException(
          'Solo puedes eliminar proyectos de tu equipo',
        );
      }
    }

    const deleted = await this.prisma.project.delete({
      where: { id },
    });

    return this.toDeletedProjectResponse(deleted);
  }

  private toProjectResponse(
    project: Project & { team?: { id: string; name: string } | null },
  ): ProjectResponse {
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      isActive: project.isActive,
      companyId: project.companyId,
      categoryId: project.categoryId,
      teamId: project.teamId,
      team: project.team ?? null,
      delegation: project.delegation,
      clientName: project.clientName,
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

  // ---------------------------------------------------------
  // PROJECT CATEGORIES
  // ---------------------------------------------------------

  async findAllCategories(
    companyId: string,
  ): Promise<ProjectCategoryResponse[]> {
    const categories = await this.prisma.projectCategory.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    return categories.map((c) => this.toProjectCategoryResponse(c));
  }

  async findOneCategory(
    id: string,
    companyId: string,
  ): Promise<ProjectCategoryResponse> {
    const category = await this.prisma.projectCategory.findFirst({
      where: { id, companyId },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return this.toProjectCategoryResponse(category);
  }

  async createCategory(
    dto: CreateProjectCategoryDto,
    companyId: string,
  ): Promise<ProjectCategoryResponse> {
    // Check if category name already exists in this company
    const existing = await this.prisma.projectCategory.findFirst({
      where: {
        companyId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una categoría con el nombre "${dto.name}"`,
      );
    }

    const category = await this.prisma.projectCategory.create({
      data: {
        name: dto.name,
        companyId,
      },
    });

    return this.toProjectCategoryResponse(category);
  }

  async updateCategory(
    id: string,
    dto: UpdateProjectCategoryDto,
    companyId: string,
  ): Promise<ProjectCategoryResponse> {
    const existing = await this.prisma.projectCategory.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    // Check if new name conflicts with another category
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.projectCategory.findFirst({
        where: {
          companyId,
          name: dto.name,
          id: { not: id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Ya existe una categoría con el nombre "${dto.name}"`,
        );
      }
    }

    const category = await this.prisma.projectCategory.update({
      where: { id },
      data: {
        name: dto.name,
      },
    });

    return this.toProjectCategoryResponse(category);
  }

  async removeCategory(
    id: string,
    companyId: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.prisma.projectCategory.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    // Check if category is in use by any projects
    const projectsCount = await this.prisma.project.count({
      where: { categoryId: id },
    });

    if (projectsCount > 0) {
      throw new ConflictException(
        `No se puede eliminar la categoría porque está siendo utilizada en ${projectsCount} proyecto(s)`,
      );
    }

    await this.prisma.projectCategory.delete({
      where: { id },
    });

    return { success: true };
  }

  private toProjectCategoryResponse(
    category: ProjectCategory,
  ): ProjectCategoryResponse {
    return {
      id: category.id,
      name: category.name,
    };
  }
}
