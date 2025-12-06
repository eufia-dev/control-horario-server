import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

type RequestWithUser = Request & { user: JwtPayload };

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
