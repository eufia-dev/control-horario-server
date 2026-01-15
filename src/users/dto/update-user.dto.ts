import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  TEAM_LEADER = 'TEAM_LEADER',
  WORKER = 'WORKER',
  AUDITOR = 'AUDITOR',
}

export enum RelationType {
  EMPLOYEE = 'EMPLOYEE',
  CONTRACTOR = 'CONTRACTOR',
  GUEST = 'GUEST',
}

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  salary?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  hourlyCost?: number;

  @IsBoolean()
  @IsOptional()
  isActive: boolean;

  @IsEnum(UserRole)
  @IsOptional()
  role: UserRole;

  @IsEnum(RelationType)
  @IsOptional()
  relation: RelationType;

  @IsUUID()
  @IsOptional()
  teamId?: string | null;
}
