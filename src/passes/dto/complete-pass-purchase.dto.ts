import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CompletePassPurchaseDto {
  @IsOptional()
  @IsString()
  auth0_id?: string;

  @Type(() => Number)
  @IsInt()
  gym_id: number;

  @IsString()
  stripe_checkout_session_id: string;

  @IsOptional()
  @IsString()
  stripe_payment_intent_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  purchase_type?: string;
}
