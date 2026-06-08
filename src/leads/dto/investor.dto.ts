import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InvestmentRange } from '../entities/investor-enquiry.entity';

const INVESTMENT_RANGES: InvestmentRange[] = [
  'under-100k',
  '100k-500k',
  '500k-1m',
  '1m-plus',
  'strategic',
];

export class InvestorDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsIn(INVESTMENT_RANGES, { message: 'Please select a valid investment range' })
  investmentRange?: InvestmentRange;

  @IsOptional()
  @IsString()
  message?: string;
}
