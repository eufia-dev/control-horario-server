import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateExternalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsPositive()
  hourlyCost: number;
}

