export class EventResponseDto {
  id: number;
  user_id: string | null;
  admin_user: string | null;
  gym_id: string | null;
  gym_chain_id: string | null;
  gym_name: string | null;
  event_type: string;
  event_description: string;
  created_at: Date;
}

