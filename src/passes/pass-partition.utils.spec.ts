import {
  isActivePass,
  isPassHistory,
  partitionPasses,
  PASS_STATUS_ACTIVE,
  PASS_STATUS_EXPIRED,
  PASS_STATUS_USED,
} from './pass-partition.utils';

describe('pass-partition.utils', () => {
  const now = new Date('2026-08-19T12:00:00.000Z');
  const future = '2026-08-19T18:00:00.000Z';
  const past = '2026-08-19T10:00:00.000Z';

  it('treats active unexpired passes as active', () => {
    const pass = { status: PASS_STATUS_ACTIVE, valid_until: future };
    expect(isActivePass(pass, now)).toBe(true);
    expect(isPassHistory(pass, now)).toBe(false);
  });

  it('puts used passes in history even when valid_until is still in the future', () => {
    const pass = { status: PASS_STATUS_USED, valid_until: future };
    expect(isActivePass(pass, now)).toBe(false);
    expect(isPassHistory(pass, now)).toBe(true);
  });

  it('puts expired passes in history', () => {
    const pass = { status: PASS_STATUS_EXPIRED, valid_until: past };
    expect(isActivePass(pass, now)).toBe(false);
    expect(isPassHistory(pass, now)).toBe(true);
  });

  it('puts time-expired active passes in history', () => {
    const pass = { status: PASS_STATUS_ACTIVE, valid_until: past };
    expect(isActivePass(pass, now)).toBe(false);
    expect(isPassHistory(pass, now)).toBe(true);
  });

  it('partitions mixed passes without overlap', () => {
    const passes = [
      { id: 1, status: PASS_STATUS_ACTIVE, valid_until: future },
      { id: 2, status: PASS_STATUS_USED, valid_until: future },
      { id: 3, status: PASS_STATUS_EXPIRED, valid_until: past },
    ];

    const { activePasses, passHistory } = partitionPasses(passes, now);

    expect(activePasses.map((p) => p.id)).toEqual([1]);
    expect(passHistory.map((p) => p.id)).toEqual([2, 3]);
    expect(passHistory.some((p) => p.status === PASS_STATUS_USED)).toBe(true);
  });
});
