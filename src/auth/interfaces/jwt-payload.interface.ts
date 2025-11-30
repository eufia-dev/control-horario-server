export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  mustChangePassword: boolean;
  isAdmin: boolean;
}
