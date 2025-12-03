export class AdminPassResponseDto {
  id: number;
  user_id: string;
  gym_id: number;
  pass_code: string;
  status: string;
  valid_until: Date | null;
  used_at: Date | null;
  qr_code_url: string | null;
  created_at: Date;
  updated_at: Date;
  subscription_tier: string | null;
}

