import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponse, UsersService } from './users.service.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Req() req: RequestWithUser): Promise<UserResponse[]> {
    return this.usersService.findAll(req.user.organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<UserResponse> {
    return this.usersService.findOne(id, req.user.organizationId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: RequestWithUser,
  ): Promise<UserResponse> {
    return this.usersService.update(id, updateUserDto, req.user.organizationId);
  }
}
