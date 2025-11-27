export interface JwtPayload {
  sub: string;
  email: string;
  mustChangePassword: boolean;
}
