import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProjectCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
