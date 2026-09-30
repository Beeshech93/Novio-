import { couponDiscountCents, couponProblem, CouponLike } from './coupon-logic';

const base: CouponLike = { kind: 'PERCENT', value: 10, minSubtotal: 0, maxUses: null, usedCount: 0, startsAt: null, endsAt: null, active: true };
const now = new Date('2026-06-15T00:00:00Z');

describe('coupons', () => {
  it('percent and fixed discounts, capped at the subtotal', () => {
    expect(couponDiscountCents(base, 20000)).toBe(2000);
    expect(couponDiscountCents({ ...base, kind: 'FIXED', value: 50 }, 20000)).toBe(5000);
    expect(couponDiscountCents({ ...base, kind: 'FIXED', value: 500 }, 20000)).toBe(20000);
    expect(couponDiscountCents({ ...base, value: 150 }, 20000)).toBe(20000);
  });
  it('validity rules', () => {
    expect(couponProblem(base, 1000, now)).toBeNull();
    expect(couponProblem({ ...base, active: false }, 1000, now)).toMatch(/inactivo/);
    expect(couponProblem({ ...base, endsAt: new Date('2026-06-01') }, 1000, now)).toMatch(/expiró/);
    expect(couponProblem({ ...base, startsAt: new Date('2026-07-01') }, 1000, now)).toMatch(/vigente/);
    expect(couponProblem({ ...base, maxUses: 5, usedCount: 5 }, 1000, now)).toMatch(/límite/);
    expect(couponProblem({ ...base, minSubtotal: 100 }, 5000, now)).toMatch(/mínimo/);
  });
});
