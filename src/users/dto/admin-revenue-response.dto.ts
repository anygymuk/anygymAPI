export class AdminRevenuePassDto {
  id: number;
  user_id: string;
  gym_id: number;
  gym_name: string;
  pass_code: string;
  status: string;
  used_at: Date | null;
  created_at: Date;
  subscription_tier: string | null;
  pass_cost: number | null;
}

export class AdminRevenueResponseDto {
  revenue: {
    total_passes: number;
    total_revenue: number;
    standard_members: number;
    premium_members: number;
    elite_members: number;
  };
  passes: AdminRevenuePassDto[];
}

