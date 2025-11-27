import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

const ACCESS_TOKEN_COOKIE = 'access_token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Token de autenticación faltante');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET ?? 'dev-secret',
      });

      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
