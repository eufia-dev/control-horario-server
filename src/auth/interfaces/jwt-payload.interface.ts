import type { UserRole, RelationType } from '@prisma/client';

export interface JwtPayload {
  sub: string; // User ID (from users table)
  authId: string; // Supabase Auth UID
  email: string;
  companyId: string; // Company ID
  role: UserRole; // OWNER | ADMIN | TEAM_LEADER | WORKER | AUDITOR
  relation: RelationType; // EMPLOYEE | CONTRACTOR | GUEST
  teamId: string | null; // Team ID (for team-scoped access)
  hasProjectsFeature: boolean; // Whether company has projects feature enabled
  hasCostsFeature: boolean; // Whether company has costs feature enabled
}
