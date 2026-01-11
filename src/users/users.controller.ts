import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { CheckUserAccess } from '../auth/decorators/check-user-access.decorator.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TeamLeaderGuard } from '../auth/team-leader.guard.js';
import { TeamScopeService } from '../auth/team-scope.service.js';
import { UserAccessGuard } from '../auth/user-access.guard.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponse, UsersService } from './users.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('users')
@UseGuards(JwtAuthGuard, TeamLeaderGuard, UserAccessGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly teamScopeService: TeamScopeService,
  ) {}

  @Get()
  async findAll(@Req() req: RequestWithUser): Promise<UserResponse[]> {
    // Team leaders can see ALL users (to be able to add them to their team)
    // but can only edit users in their own team (enforced in PATCH/DELETE)
    if (this.teamScopeService.isTeamLeaderOrAbove(req.user)) {
      return this.usersService.findAll(req.user.companyId);
    }
    // Workers can only see themselves
    const userIds = await this.teamScopeService.getUserIdsInScope(req.user);
    return this.usersService.findAll(req.user.companyId, { userIds });
  }

  @Get(':id')
  @CheckUserAccess({ allowTeamLeadersViewAll: true })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<UserResponse> {
    return this.usersService.findOne(id, req.user.companyId);
  }

  @Patch(':id')
  @CheckUserAccess()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: RequestWithUser,
  ): Promise<UserResponse> {
    return this.usersService.update(id, updateUserDto, req.user.companyId);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.usersService.delete(id, req.user.companyId);
  }
}
