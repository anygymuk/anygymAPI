export class AdminUserResponseDto {
  auth0_id: string;
  name: string | null;
  email: string | null;
  gym_chain: {
    name: string | null;
    logo_url: string | null;
    brand_color: string | null;
  } | null;
}

