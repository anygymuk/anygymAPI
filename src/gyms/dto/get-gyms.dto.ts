import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class GetGymsDto {
  @IsOptional()
  @IsString()
  required_tier?: string;

  @IsOptional()
  @IsString()
  amenities?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gym_chain_id?: number;
}

