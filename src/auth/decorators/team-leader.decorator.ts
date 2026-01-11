import { UseGuards } from '@nestjs/common';
import { TeamLeaderGuard } from '../team-leader.guard.js';
import { JwtAuthGuard } from '../jwt-auth.guard.js';

export const TeamLeaderOnly = () => UseGuards(JwtAuthGuard, TeamLeaderGuard);
