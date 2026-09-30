import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService coupons', () => {
  const prod = { id: '11111111-1111-1111-1111-111111111111', name: 'Gel', price: '100.00', taxRate: '0' };
  const mk = (coupon: any) => {
    const tx: any = {
      customer: { findFirst: jest.fn() }, product: { findMany: jest.fn().mockResolvedValue([prod]) },
      inventory: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      coupon: { findFirst: jest.fn().mockResolvedValue(coupon), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      order: { create: jest.fn().mockImplementation(async (a: any) => ({ id: 'o1', ...a.data })) },
    };
    return { tx, svc: new OrdersService({ $transaction: (fn: any) => fn(tx) } as any) };
  };
  const valid = { id: 'cp1', kind: 'PERCENT', value: 10, minSubtotal: 0, maxUses: 5, usedCount: 1, startsAt: null, endsAt: null, active: true };
  const dto = { items: [{ productId: prod.id, quantity: 2 }], couponCode: 'verano10' };

  it('applies the discount and scopes the coupon lookup to the business', async () => {
    const { svc, tx } = mk(valid);
    const o: any = await svc.create('bA', dto);
    expect(tx.coupon.findFirst.mock.calls[0][0].where).toMatchObject({ businessId: 'bA', code: 'VERANO10' });
    expect(o.discount).toBe(20); expect(o.total).toBe(180); expect(o.couponId).toBe('cp1');
    expect(tx.coupon.updateMany.mock.calls[0][0].where).toMatchObject({ id: 'cp1', businessId: 'bA', usedCount: { lt: 5 } });
  });
  it('rejects unknown and expired coupons', async () => {
    await expect(mk(null).svc.create('bA', dto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(mk({ ...valid, endsAt: new Date('2020-01-01') }).svc.create('bA', dto)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects when the guarded usage claim loses a race', async () => {
    const { svc, tx } = mk(valid);
    tx.coupon.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.create('bA', dto)).rejects.toBeInstanceOf(ConflictException);
  });
});
