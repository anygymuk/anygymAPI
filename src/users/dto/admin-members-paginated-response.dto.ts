import { AdminMemberResponseDto } from './admin-member-response.dto';

export class AdminMembersPaginatedResponseDto {
  results: AdminMemberResponseDto[];
  pagination: {
    total_results: number;
    page: number;
    result_set: string;
  };
}

