import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string; // User ID (from users table)
  authId: string; // Supabase Auth UID
  email: string;
  companyId: string; // Company ID
  role: UserRole; // OWNER | ADMIN | WORKER | AUDITOR
}
