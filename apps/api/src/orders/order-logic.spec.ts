import { canTransition, computeTotals } from './order-logic';

describe('order logic', () => {
  it('computes totals in cents with tax and capped discount', () => {
    const t = computeTotals([{ unitPrice: 19.99, quantity: 3, taxRate: 16 }, { unitPrice: 10, quantity: 1, taxRate: 0 }], 5);
    expect(t.subtotal).toBe(6997);
    expect(t.tax).toBe(960); // 5997 * 16% = 959.52 -> 960
    expect(t.discount).toBe(500);
    expect(t.total).toBe(7457);
    expect(computeTotals([{ unitPrice: 10, quantity: 1, taxRate: 0 }], 999).total).toBe(0);
  });
  it('enforces status transitions', () => {
    expect(canTransition('NEW', 'CONFIRMED')).toBe(true);
    expect(canTransition('NEW', 'COMPLETED')).toBe(false);
    expect(canTransition('CANCELLED', 'NEW')).toBe(false);
    expect(canTransition('COMPLETED', 'REFUNDED')).toBe(true);
  });
});
