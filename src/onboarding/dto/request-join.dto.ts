import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RequestJoinDto {
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
