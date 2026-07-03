export class GetRevenueDto {
  from_date: string;
  to_date: string;
  gym_id?: number;
  page?: number;
  passes_per_page?: number;
}

