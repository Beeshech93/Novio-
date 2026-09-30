import { toCents } from '../orders/order-logic';

export interface CouponLike {
  kind: 'PERCENT' | 'FIXED'; value: { toString(): string } | number; minSubtotal: { toString(): string } | number;
  maxUses: number | null; usedCount: number; startsAt: Date | null; endsAt: Date | null; active: boolean;
}

/** Returns the reason a coupon can't be used, or null when it's valid for this subtotal. */
export function couponProblem(c: CouponLike, subtotalCents: number, now = new Date()): string | null {
  if (!c.active) return 'Cupón inactivo';
  if (c.startsAt && c.startsAt > now) return 'El cupón aún no está vigente';
  if (c.endsAt && c.endsAt < now) return 'El cupón expiró';
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return 'El cupón ya alcanzó su límite de usos';
  if (subtotalCents < toCents(c.minSubtotal)) return 'No alcanzas el monto mínimo del cupón';
  return null;
}

export function couponDiscountCents(c: CouponLike, subtotalCents: number): number {
  const raw = c.kind === 'PERCENT' ? Math.round((subtotalCents * Number(c.value.toString())) / 100) : toCents(c.value);
  return Math.max(0, Math.min(raw, subtotalCents));
}
