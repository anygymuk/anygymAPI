export class UserResponseDto {
  auth0_id: string;
  email: string;
  full_name: string | null;
  onboarding_completed: boolean;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_postcode: string | null;
  date_of_birth: string | null;
  stripe_customer_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
}

