export class AdminMemberResponseDto {
  member_email: string;
  passes: number;
  last_visit: Date | null;
  has_active_pass: boolean;
}

