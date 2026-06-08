import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { GymGroupLocations } from '../entities/gym-group-enquiry.entity';

const LOCATIONS: GymGroupLocations[] = ['1-5', '6-10', '11-20', '21-50', '50+'];

export class GymGroupDto {
  @IsNotEmpty()
  @IsString()
  contactName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsNotEmpty()
  @IsIn(LOCATIONS, { message: 'Please select a valid number of locations' })
  locations: GymGroupLocations;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
