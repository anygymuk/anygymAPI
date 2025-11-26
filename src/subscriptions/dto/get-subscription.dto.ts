import { IsOptional, IsString } from 'class-validator';

export class GetSubscriptionDto {
  @IsOptional()
  @IsString()
  status?: string;
}

