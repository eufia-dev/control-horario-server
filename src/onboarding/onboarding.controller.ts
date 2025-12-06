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
import {
  OnboardingGuard,
  OnboardingPayload,
} from '../auth/onboarding.guard.js';
import { OnboardingService, OnboardingStatus } from './onboarding.service.js';
import { CreateCompanyDto, RequestJoinDto } from './dto/index.js';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userName: string;
}

type RequestWithOnboarding = Request & { onboardingUser: OnboardingPayload };

@Controller('onboarding')
@UseGuards(OnboardingGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * Check onboarding status for the current Supabase user
   */
  @Post('check')
  async checkStatus(
    @Req() req: RequestWithOnboarding,
  ): Promise<OnboardingStatus> {
    const { authId, email } = req.onboardingUser;
    return this.onboardingService.checkStatus(authId, email);
  }

  /**
   * Create a new company and become the owner
   */
  @Post('create-company')
  async createCompany(
    @Req() req: RequestWithOnboarding,
    @Body() dto: CreateCompanyDto,
  ): Promise<OnboardingStatus> {
    const { authId, email } = req.onboardingUser;
    return this.onboardingService.createCompany(authId, email, dto);
  }

  /**
   * Accept an invitation and join the company
   */
  @Post('accept-invitation/:token')
  async acceptInvitation(
    @Req() req: RequestWithOnboarding,
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ): Promise<OnboardingStatus> {
    const { authId, email } = req.onboardingUser;
    return this.onboardingService.acceptInvitation(
      authId,
      email,
      token,
      dto.userName,
    );
  }

  /**
   * Request to join an existing company
   */
  @Post('request-join')
  async requestJoin(
    @Req() req: RequestWithOnboarding,
    @Body() dto: RequestJoinDto,
  ): Promise<{ id: string; companyName: string; status: string }> {
    const { authId, email } = req.onboardingUser;
    return this.onboardingService.requestJoin(authId, email, dto);
  }

  /**
   * Get the user's pending join requests
   */
  @Get('my-requests')
  async getMyRequests(
    @Req() req: RequestWithOnboarding,
  ): Promise<
    { id: string; companyName: string; status: string; createdAt: Date }[]
  > {
    const { authId } = req.onboardingUser;
    return this.onboardingService.getMyRequests(authId);
  }

  /**
   * Cancel a pending join request
   */
  @Delete('my-requests/:id')
  async cancelRequest(
    @Req() req: RequestWithOnboarding,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    const { authId } = req.onboardingUser;
    await this.onboardingService.cancelRequest(authId, id);
    return { success: true };
  }
}
