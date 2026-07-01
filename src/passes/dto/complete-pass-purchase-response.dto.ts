import { PassResponseDto } from './pass-response.dto';

export class CompletePassPurchaseResponseDto {
  pass: PassResponseDto;
  purchase_id: number;
  already_fulfilled: boolean;
}
