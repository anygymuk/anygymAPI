export class AdminGymDetailResponseDto {
  id: number;
  name: string;
  address: string;
  postcode: string;
  city: string;
  latitude: number;
  longitude: number;
  required_tier: string;
  amenities: string[] | null;
  opening_hours: any | null;
  phone: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  status: string;
}

