import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddMemberDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
