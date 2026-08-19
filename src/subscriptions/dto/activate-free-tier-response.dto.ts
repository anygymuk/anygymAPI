import { MembershipResponseDto } from '../../users/dto/membership-response.dto';

export class ActivateFreeTierResponseDto {
  membership: MembershipResponseDto;
  /** True when a free subscription was created or normalised. False if a paid subscription is active. */
  activated: boolean;
}
