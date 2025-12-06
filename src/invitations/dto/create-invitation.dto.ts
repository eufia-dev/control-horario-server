import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(['ADMIN', 'WORKER', 'AUDITOR'])
  @IsOptional()
  role?: 'ADMIN' | 'WORKER' | 'AUDITOR' = 'WORKER';
}
