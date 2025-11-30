import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNumber()
  @Min(0)
  hourlyCost: number;

  @IsBoolean()
  isActive: boolean;

  @IsBoolean()
  isAdmin: boolean;
}

