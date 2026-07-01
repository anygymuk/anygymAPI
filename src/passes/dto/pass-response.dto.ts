export class PassResponseDto {
  id: number;
  user_id: string;
  gym_id: number;
  gym_name: string | null;
  gym_chain_id: number | null;
  gym_chain_name: string | null;
  gym_chain_logo: string | null;
  gym_latitude: number | null;
  gym_longitude: number | null;
  pass_code: string;
  status: string;
  valid_until: string | null;
  used_at: string | null;
  qrcode_url: string | null;
  created_at: string;
  updated_at: string;
  subscription_tier: string | null;
  pass_cost?: number | null;
  purchase_id?: number | null;
}

