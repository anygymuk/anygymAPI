import { IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  address_line1?: string;

  @IsOptional()
  @IsString()
  address_line2?: string;

  @IsOptional()
  @IsString()
  address_city?: string;

  @IsOptional()
  @IsString()
  address_postcode?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  emergency_contact_number?: string;

  @IsOptional()
  @IsBoolean()
  onboarding_completed?: boolean;

  @IsOptional()
  @IsBoolean()
  pass_notification_consent?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing_consent?: boolean;
}

