import { PassResponseDto } from './pass-response.dto';

export class SubscriptionSummaryDto {
  tier: string;
  monthly_limit: number;
  visits_used: number;
  price: number;
  next_billing_date: string | null;
  guest_passes_limit: number;
  guest_passes_used: number;
  current_period_start: string | null;
  current_period_end: string | null;
}

export class PassesWithSubscriptionResponseDto {
  subscription: SubscriptionSummaryDto | null;
  active_passes: PassResponseDto[];
  pass_history: PassResponseDto[];
}

