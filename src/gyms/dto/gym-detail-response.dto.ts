export class GymChainDetailDto {
  id: number;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  website: string | null;
  description: string | null;
  terms?: string | null;
  health_statement?: string | null;
  terms_url?: string | null;
  health_statement_url?: string | null;
}

export class GymDetailResponseDto {
  id: number;
  name: string;
  address: string;
  postcode: string;
  city: string;
  latitude: number;
  longitude: number;
  required_tier: string;
  amenities: string[];
  opening_hours: any;
  phone: string | null;
  image_url: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
  status: string;
  gym_chain: GymChainDetailDto | null;
}

