import { AdminPassResponseDto } from './admin-pass-response.dto';

export class AdminPassesPaginatedResponseDto {
  results: AdminPassResponseDto[];
  pagination: {
    total_results: number;
    page: number;
    result_set: string;
  };
}

