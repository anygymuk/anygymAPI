export class MembershipResponseDto {
  id: number;
  user_id: string;
  tier: string;
  status: string;
  monthly_limit: number;
  visits_used: number;
  guest_passes_limit: number;
  guest_passes_used: number;
  price: number;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}
