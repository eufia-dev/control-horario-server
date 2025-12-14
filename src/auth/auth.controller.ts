import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type ProfileInfo, type PendingInvitation } from './auth.service.js';
import { JwtAuthGuard, type RequestWithUser } from './jwt-auth.guard.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Get current authenticated user profile
   * Authentication is handled by Supabase on the frontend
   * This endpoint validates the token and returns user data
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: RequestWithUser) {
    const user = await this.authService.getProfile(req.user.sub);
    return { user };
  }

  /**
   * GET /auth/profiles
   * Get all profiles (company memberships) for the authenticated Supabase user
   * Used for multi-tenancy: allows user to see and switch between companies
   */
  @UseGuards(JwtAuthGuard)
  @Get('profiles')
  async getProfiles(@Req() req: RequestWithUser): Promise<{ profiles: ProfileInfo[]; currentProfileId: string }> {
    const profiles = await this.authService.getAllProfiles(req.user.authId);
    return {
      profiles,
      currentProfileId: req.user.sub,
    };
  }

  /**
   * POST /auth/switch-profile
   * Switch to a different profile (company membership)
   * Validates that the profileId belongs to the authenticated user's authId
   * Returns the new profile info for the frontend to update its state
   */
  @UseGuards(JwtAuthGuard)
  @Post('switch-profile')
  async switchProfile(
    @Body('profileId') profileId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ profile: ProfileInfo }> {
    if (!profileId) {
      throw new UnauthorizedException('profileId es requerido');
    }

    // Get all profiles to validate the requested profile belongs to this user
    const profiles = await this.authService.getAllProfiles(req.user.authId);
    const targetProfile = profiles.find((p) => p.id === profileId);

    if (!targetProfile) {
      throw new UnauthorizedException(
        'Perfil no válido o no pertenece a este usuario',
      );
    }

    return { profile: targetProfile };
  }

  /**
   * GET /auth/pending-invitations
   * Get pending invitations for the authenticated user's email
   * Used for multi-tenancy: shows invitations to join other companies
   */
  @UseGuards(JwtAuthGuard)
  @Get('pending-invitations')
  async getPendingInvitations(
    @Req() req: RequestWithUser,
  ): Promise<{ invitations: PendingInvitation[] }> {
    const invitations = await this.authService.getPendingInvitationsForUser(
      req.user.email,
      req.user.authId,
    );
    return { invitations };
  }

  /**
   * POST /auth/accept-invitation/:token
   * Accept an invitation to join a new company (for authenticated users)
   * Creates a new profile in the invited company
   */
  @UseGuards(JwtAuthGuard)
  @Post('accept-invitation/:token')
  async acceptInvitation(
    @Param('token') token: string,
    @Req() req: RequestWithUser,
  ): Promise<{ profile: ProfileInfo }> {
    if (!token) {
      throw new BadRequestException('Token de invitación requerido');
    }

    const profile = await this.authService.acceptInvitationForExistingUser(
      req.user.authId,
      req.user.email,
      token,
    );

    return { profile };
  }

  /**
   * POST /auth/request-join
   * Request to join a company by invite code (for authenticated users)
   * Creates a join request that company admins can approve
   */
  @UseGuards(JwtAuthGuard)
  @Post('request-join')
  async requestJoinCompany(
    @Body('inviteCode') inviteCode: string,
    @Req() req: RequestWithUser,
  ): Promise<{ companyName: string; status: string }> {
    if (!inviteCode) {
      throw new BadRequestException('Código de invitación requerido');
    }

    // Get user's name from current profile
    const currentProfile = await this.authService.getProfile(req.user.sub);

    return this.authService.requestJoinByInviteCode(
      req.user.authId,
      req.user.email,
      currentProfile.name,
      inviteCode,
    );
  }

  /**
   * Logout endpoint - client should clear Supabase session
   * This endpoint can be used for any server-side cleanup if needed
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    // Supabase handles session invalidation on the client side
    // This endpoint can be extended for server-side cleanup (e.g., invalidate cache)
    return { success: true };
  }
}
