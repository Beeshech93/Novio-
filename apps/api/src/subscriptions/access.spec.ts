import { addPeriod, hasAccess, monthlyCents } from './access';

const day = 86_400_000;
const now = new Date('2026-06-15T00:00:00Z');
const at = (d: number) => new Date(now.getTime() + d * day);

describe('subscription access', () => {
  it('no subscription = no access', () => expect(hasAccess(null, now)).toBe(false));
  it('active within period', () => expect(hasAccess({ status: 'active', currentPeriodEnd: at(5) }, now)).toBe(true));
  it('active but period ended', () => expect(hasAccess({ status: 'active', currentPeriodEnd: at(-1) }, now)).toBe(false));
  it('trial ends', () => {
    expect(hasAccess({ status: 'trialing', currentPeriodEnd: at(3) }, now)).toBe(true);
    expect(hasAccess({ status: 'trialing', currentPeriodEnd: at(-3) }, now)).toBe(false);
  });
  it('past_due has a short grace window', () => {
    expect(hasAccess({ status: 'past_due', currentPeriodEnd: at(-2) }, now)).toBe(true);
    expect(hasAccess({ status: 'past_due', currentPeriodEnd: at(-4) }, now)).toBe(false);
  });
  it('cancelled/paused/expired never', () => {
    for (const status of ['cancelled', 'paused', 'expired'] as const) expect(hasAccess({ status, currentPeriodEnd: at(30) }, now)).toBe(false);
  });
  it('manual (no end date) stays active', () => expect(hasAccess({ status: 'active', currentPeriodEnd: null }, now)).toBe(true));
  it('period + MRR helpers', () => {
    expect(addPeriod(new Date('2026-01-15T00:00:00Z'), 'MONTHLY').getUTCMonth()).toBe(1);
    expect(addPeriod(new Date('2026-01-15T00:00:00Z'), 'YEARLY').getUTCFullYear()).toBe(2027);
    expect(monthlyCents(199000, 'YEARLY')).toBe(16583);
  });
});
