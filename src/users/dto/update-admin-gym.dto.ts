import { IsOptional, IsString, IsNumber, IsArray } from 'class-validator';

export class UpdateAdminGymDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  postcode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  required_tier?: string;

  @IsOptional()
  @IsArray()
  amenities?: string[];

  @IsOptional()
  opening_hours?: any;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

