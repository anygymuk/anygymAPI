import { IsOptional, IsString } from 'class-validator';

export class GetPassesDto {
  @IsOptional()
  @IsString()
  status?: string;
}

