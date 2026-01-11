import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  // Note: TEAM_LEADER cannot be assigned via invitation (requires team assignment)
  @IsEnum(['ADMIN', 'WORKER', 'AUDITOR'])
  @IsOptional()
  role?: 'ADMIN' | 'WORKER' | 'AUDITOR' = 'WORKER';

  @IsEnum(['EMPLOYEE', 'CONTRACTOR', 'GUEST'])
  @IsOptional()
  relation?: 'EMPLOYEE' | 'CONTRACTOR' | 'GUEST' = 'EMPLOYEE';
}
