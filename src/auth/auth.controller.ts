import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';

type RequestWithUser = Request & { user: JwtPayload };

// Cookie configuration
const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      body.email,
      body.password,
    );

    this.setAccessTokenCookie(res, accessToken);
    this.setRefreshTokenCookie(res, refreshToken);

    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset-password')
  async resetPassword(
    @Req() req: RequestWithUser,
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const {
      accessToken,
      refreshToken,
      user: updatedUser,
    } = await this.authService.resetPassword(
      req.user.sub,
      body.currentPassword,
      body.newPassword,
    );

    this.setAccessTokenCookie(res, accessToken);
    this.setRefreshTokenCookie(res, refreshToken);

    return { user: updatedUser };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      | string
      | undefined;

    if (!refreshToken) {
      this.clearAuthCookies(res);
      return { error: 'No refresh token provided' };
    }

    try {
      const { accessToken, user } =
        await this.authService.refreshAccessToken(refreshToken);

      this.setAccessTokenCookie(res, accessToken);

      return { user };
    } catch {
      this.clearAuthCookies(res);
      throw new Error('Invalid refresh token');
    }
  }

  private setAccessTokenCookie(res: Response, token: string): void {
    res.cookie(ACCESS_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
  }

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/auth', // Restrict refresh token to auth routes only
    });
  }

  private clearAuthCookies(res: Response): void {
    const expiredDate = new Date(0);

    res.cookie(ACCESS_TOKEN_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiredDate,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiredDate,
      path: '/auth',
    });
  }
}
