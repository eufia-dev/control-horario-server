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
import {
  AuthService,
  type ProfileInfo,
  type PendingInvitation,
} from './auth.service.js';
import { JwtAuthGuard, type RequestWithUser } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: RequestWithUser) {
    const user = await this.authService.getProfile(req.user.sub);
    return { user };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profiles')
  async getProfiles(
    @Req() req: RequestWithUser,
  ): Promise<{ profiles: ProfileInfo[]; currentProfileId: string }> {
    const profiles = await this.authService.getAllProfiles(req.user.authId);
    return {
      profiles,
      currentProfileId: req.user.sub,
    };
  }

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

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    // Supabase handles session invalidation on the client side
    // This endpoint can be extended for server-side cleanup (e.g., invalidate cache)
    return { success: true };
  }
}
