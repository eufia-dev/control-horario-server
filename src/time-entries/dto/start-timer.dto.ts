import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class StartTimerDto {
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsUUID()
  @IsNotEmpty()
  typeId: string;

  @IsBoolean()
  @IsOptional()
  isOffice?: boolean;
}
