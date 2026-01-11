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
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TeamLeaderGuard } from '../auth/team-leader.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateTeamDto, UpdateTeamDto, AddMemberDto } from './dto/index.js';
import {
  TeamsService,
  type TeamResponse,
  type TeamDetailResponse,
} from './teams.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // ==================== Team Leader endpoints ====================
  // These allow team leaders to manage their own team
  // Note: These must come BEFORE the parameterized :id routes

  @Get('my-team')
  @UseGuards(TeamLeaderGuard)
  getMyTeam(@Req() req: RequestWithUser): Promise<TeamDetailResponse> {
    return this.teamsService.getTeamByLeader(req.user.sub, req.user.companyId);
  }

  @Post('my-team/members')
  @UseGuards(TeamLeaderGuard)
  addMemberToMyTeam(
    @Body() dto: AddMemberDto,
    @Req() req: RequestWithUser,
  ): Promise<TeamDetailResponse> {
    return this.teamsService.addMemberByLeader(
      req.user.sub,
      dto.userId,
      req.user.companyId,
    );
  }

  @Patch('my-team')
  @UseGuards(TeamLeaderGuard)
  updateMyTeam(
    @Body() dto: UpdateTeamDto,
    @Req() req: RequestWithUser,
  ): Promise<TeamDetailResponse> {
    return this.teamsService.updateByLeader(
      req.user.sub,
      dto,
      req.user.companyId,
    );
  }

  @Delete('my-team/members/:userId')
  @UseGuards(TeamLeaderGuard)
  removeMemberFromMyTeam(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: RequestWithUser,
  ): Promise<TeamDetailResponse> {
    return this.teamsService.removeMemberByLeader(
      req.user.sub,
      userId,
      req.user.companyId,
    );
  }

  // ==================== Admin-only endpoints ====================

  @Get()
  @UseGuards(AdminGuard)
  findAll(@Req() req: RequestWithUser): Promise<TeamResponse[]> {
    return this.teamsService.findAll(req.user.companyId);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<TeamDetailResponse> {
    return this.teamsService.findOne(id, req.user.companyId);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @Body() dto: CreateTeamDto,
    @Req() req: RequestWithUser,
  ): Promise<TeamDetailResponse> {
    return this.teamsService.create(dto, req.user.companyId);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @Req() req: RequestWithUser,
  ): Promise<TeamDetailResponse> {
    return this.teamsService.update(id, dto, req.user.companyId);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean }> {
    return this.teamsService.remove(id, req.user.companyId);
  }

  @Post(':id/members')
  @UseGuards(AdminGuard)
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
    @Req() req: RequestWithUser,
  ): Promise<TeamDetailResponse> {
    return this.teamsService.addMember(id, dto.userId, req.user.companyId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(AdminGuard)
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: RequestWithUser,
  ): Promise<TeamDetailResponse> {
    return this.teamsService.removeMember(id, userId, req.user.companyId);
  }
}
