import { IsInt, IsOptional, IsString, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchasePassCheckoutDto {
  @IsOptional()
  @IsString()
  auth0_id?: string;

  @Type(() => Number)
  @IsInt()
  gym_id: number;

  @IsUrl({ require_tld: false })
  success_url: string;

  @IsUrl({ require_tld: false })
  cancel_url: string;
}
