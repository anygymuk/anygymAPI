import { AdminGymResponseDto } from './admin-gym-response.dto';

export class AdminGymsPaginatedResponseDto {
  results: AdminGymResponseDto[];
  pagination: {
    total_results: number;
    page: number;
    result_set: string;
  };
}

