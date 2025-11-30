import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { type user } from '../../generated/prisma/client.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  mustChangePassword: boolean;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResult {
  accessToken: string;
  user: AuthUser;
}

// Token expiration times
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days

@Injectable()
export class AuthService {
  private readonly bcryptRounds = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: {
        organization: true,
      },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user),
    };
  }

  async resetPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
      },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Usuario inválido');
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);

    if (!matches) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const newHash = await bcrypt.hash(newPassword, this.bcryptRounds);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: newHash,
        must_change_password: false,
      },
      include: {
        organization: true,
      },
    });

    const { accessToken, refreshToken } = await this.generateTokens(updated);

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(updated),
    };
  }

  async refreshAccessToken(refreshTokenValue: string): Promise<RefreshResult> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshTokenValue,
        { secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret' },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          organization: true,
        },
      });

      if (!user || !user.is_active) {
        throw new UnauthorizedException('Usuario inválido');
      }

      const accessToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          organizationId: user.organization_id,
          mustChangePassword: user.must_change_password ?? false,
          isAdmin: Boolean(user.is_admin),
        } as JwtPayload,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
      );

      return {
        accessToken,
        user: this.toAuthUser(user),
      };
    } catch {
      throw new UnauthorizedException('Token de refresco inválido o expirado');
    }
  }

  private async generateTokens(
    user: user,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organization_id,
      mustChangePassword: user.must_change_password ?? false,
      isAdmin: Boolean(user.is_admin),
    };

    // Access token (short-lived)
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    // Refresh token (long-lived, different secret)
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    return { accessToken, refreshToken };
  }

  private toAuthUser(
    user: user & { organization?: { name: string } },
  ): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      organizationId: user.organization_id,
      organizationName: user.organization?.name ?? '',
      mustChangePassword: user.must_change_password ?? false,
      isAdmin: Boolean(user.is_admin),
      isActive: user.is_active,
      createdAt: user.created_at,
    };
  }
}
