import { OrderStatus } from '@prisma/client';

/** All money math is done in integer cents to avoid float drift. */
export const toCents = (n: number | string | { toString(): string }) => Math.round(Number(n.toString()) * 100);
export const fromCents = (c: number) => c / 100;

export interface LineInput { unitPrice: number; quantity: number; taxRate: number }

export function computeTotals(lines: LineInput[], discount: number) {
  let subtotal = 0, tax = 0;
  for (const l of lines) {
    const line = toCents(l.unitPrice) * l.quantity;
    subtotal += line;
    tax += Math.round((line * l.taxRate) / 100);
  }
  const disc = Math.min(toCents(discount), subtotal); // discount can't exceed subtotal
  return { subtotal, tax, discount: disc, total: subtotal + tax - disc };
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'COMPLETED', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'COMPLETED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);
