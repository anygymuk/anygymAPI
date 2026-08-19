/** Pass lifecycle statuses stored on gym_passes.status */
export const PASS_STATUS_ACTIVE = 'active';
export const PASS_STATUS_USED = 'used';
export const PASS_STATUS_EXPIRED = 'expired';

export interface PassPartitionInput {
  status: string;
  valid_until: string | null;
}

/** A pass is active only when status is active and valid_until is in the future. */
export function isActivePass(
  pass: PassPartitionInput,
  now: Date = new Date(),
): boolean {
  if (pass.status !== PASS_STATUS_ACTIVE) {
    return false;
  }
  if (!pass.valid_until) {
    return false;
  }
  return new Date(pass.valid_until) > now;
}

/**
 * History includes used, expired, and time-expired active passes.
 * Used passes always belong here, even if valid_until is still in the future.
 */
export function isPassHistory(
  pass: PassPartitionInput,
  now: Date = new Date(),
): boolean {
  return !isActivePass(pass, now);
}

export function partitionPasses<T extends PassPartitionInput>(
  passes: T[],
  now: Date = new Date(),
): { activePasses: T[]; passHistory: T[] } {
  const activePasses = passes.filter((pass) => isActivePass(pass, now));
  const passHistory = passes.filter((pass) => isPassHistory(pass, now));
  return { activePasses, passHistory };
}
