import { IsString, IsNotEmpty, IsEmail, IsArray, IsOptional, IsIn, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAdminUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsIn(['gym_admin', 'gym_staff'])
  role: string;

  @IsNotEmpty()
  @IsIn(['read', 'write'])
  permission: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  access_gyms?: number[];

  @IsOptional()
  @IsString()
  subordinates?: string;

  @IsOptional()
  @IsString()
  password?: string; // Optional password for Auth0 user creation
}

