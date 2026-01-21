import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  paymentPeriod!: number; // Payment period in days (e.g., 30, 60, 90)
}
