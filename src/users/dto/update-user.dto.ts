import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
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
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

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
  relationType: RelationType;
}
