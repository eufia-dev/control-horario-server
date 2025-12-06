import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import {
  InvitationsService,
  InvitationResponse,
} from './invitations.service.js';
import { CreateInvitationDto } from './dto/index.js';

type RequestWithUser = Request & { user: JwtPayload };

@Controller('invitations')
@UseGuards(JwtAuthGuard, AdminGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  /**
   * Create a new invitation
   */
  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationResponse> {
    return this.invitationsService.create(req.user.companyId, dto);
  }

  /**
   * List all invitations for the company
   */
  @Get()
  async findAll(@Req() req: RequestWithUser): Promise<InvitationResponse[]> {
    return this.invitationsService.findAll(req.user.companyId);
  }

  /**
   * Get a specific invitation
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<InvitationResponse> {
    return this.invitationsService.findOne(id, req.user.companyId);
  }

  /**
   * Delete/cancel an invitation
   */
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean }> {
    await this.invitationsService.remove(id, req.user.companyId);
    return { success: true };
  }

  /**
   * Resend an invitation (regenerate token and extend expiry)
   */
  @Post(':id/resend')
  async resend(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<InvitationResponse> {
    return this.invitationsService.resend(id, req.user.companyId);
  }
}
