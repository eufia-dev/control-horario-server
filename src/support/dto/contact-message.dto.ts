import { IsNotEmpty, IsString } from 'class-validator';

export class ContactMessageDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
