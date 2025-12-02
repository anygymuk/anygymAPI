export class AdminMemberResponseDto {
  auth0_id: string;
  member_email: string;
  passes: number;
  last_visit: Date | null;
  has_active_pass: boolean;
}

