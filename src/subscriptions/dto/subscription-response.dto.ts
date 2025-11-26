export class SubscriptionResponseDto {
  id: number;
  user_id: string;
  tier: string;
  monthly_limit: number;
  visits_used: number;
  price: number;
  start_date: string;
  next_billing_date: string | null;
  status: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  guest_passes_limit: number;
  guest_passes_used: number;
}

