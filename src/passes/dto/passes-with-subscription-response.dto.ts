import { PassResponseDto } from './pass-response.dto';

export class RecentGymDto {
  gym_id: number;
  gym_name: string;
  gym_chain_id: number;
  gym_chain_name: string;
  gym_chain_logo: string;
}

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
  /** Up to five distinct gyms from the most recently generated passes (newest pass order). */
  recent_gyms: RecentGymDto[];
}

