import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin.guard.js';
import { JwtAuthGuard } from '../jwt-auth.guard.js';

export const AdminOnly = () => UseGuards(JwtAuthGuard, AdminGuard);
