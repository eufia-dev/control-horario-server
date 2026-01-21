import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { TeamLeaderGuard } from '../auth/team-leader.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ProjectsFeatureGuard } from '../auth/projects-feature.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { CreateProjectCategoryDto } from './dto/create-project-category.dto.js';
import { UpdateProjectCategoryDto } from './dto/update-project-category.dto.js';
import {
  DeletedProjectResponse,
  ProjectCategoryResponse,
  ProjectResponse,
  ProjectsService,
} from './projects.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('projects')
@UseGuards(JwtAuthGuard, ProjectsFeatureGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Req() req: RequestWithUser): Promise<ProjectResponse[]> {
    return this.projectsService.findAll(req.user.companyId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<ProjectResponse> {
    return this.projectsService.findOne(id, req.user.companyId);
  }

  @Post()
  @UseGuards(TeamLeaderGuard)
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Req() req: RequestWithUser,
  ): Promise<ProjectResponse> {
    return this.projectsService.create(
      createProjectDto,
      req.user.companyId,
      req.user,
    );
  }

  @Patch(':id')
  @UseGuards(TeamLeaderGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() req: RequestWithUser,
  ): Promise<ProjectResponse> {
    return this.projectsService.update(
      id,
      updateProjectDto,
      req.user.companyId,
      req.user,
    );
  }

  @Delete(':id')
  @UseGuards(TeamLeaderGuard)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<DeletedProjectResponse> {
    return this.projectsService.remove(id, req.user.companyId, req.user);
  }

  // ---------------------------------------------------------
  // PROJECT CATEGORIES
  // ---------------------------------------------------------

  @Get('categories/all')
  findAllCategories(
    @Req() req: RequestWithUser,
  ): Promise<ProjectCategoryResponse[]> {
    return this.projectsService.findAllCategories(req.user.companyId);
  }

  @Get('categories/:id')
  findOneCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<ProjectCategoryResponse> {
    return this.projectsService.findOneCategory(id, req.user.companyId);
  }

  @Post('categories')
  @UseGuards(AdminGuard)
  createCategory(
    @Body() dto: CreateProjectCategoryDto,
    @Req() req: RequestWithUser,
  ): Promise<ProjectCategoryResponse> {
    return this.projectsService.createCategory(dto, req.user.companyId);
  }

  @Patch('categories/:id')
  @UseGuards(AdminGuard)
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectCategoryDto,
    @Req() req: RequestWithUser,
  ): Promise<ProjectCategoryResponse> {
    return this.projectsService.updateCategory(id, dto, req.user.companyId);
  }

  @Delete('categories/:id')
  @UseGuards(AdminGuard)
  removeCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean }> {
    return this.projectsService.removeCategory(id, req.user.companyId);
  }
}
