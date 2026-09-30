import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const tx: any = {
    customer: { findFirst: jest.fn() },
    product: { findMany: jest.fn() },
    inventory: { updateMany: jest.fn() },
    order: { create: jest.fn().mockImplementation(async (a: any) => a.data) },
  };
  const prisma: any = { $transaction: (fn: any) => fn(tx), order: { findFirst: jest.fn() } };
  const svc = new OrdersService(prisma);
  const prod = { id: '11111111-1111-1111-1111-111111111111', name: 'Gel', price: '50.00', taxRate: '16' };
  beforeEach(() => { jest.clearAllMocks(); tx.product.findMany.mockResolvedValue([prod]); tx.inventory.updateMany.mockResolvedValue({ count: 1 }); });

  it('uses server-side prices and scopes lookups to the business', async () => {
    const o: any = await svc.create('biz-A', { items: [{ productId: prod.id, quantity: 2 }] });
    expect(tx.product.findMany.mock.calls[0][0].where).toMatchObject({ businessId: 'biz-A' });
    expect(o.subtotal).toBe(100); expect(o.tax).toBe(16); expect(o.total).toBe(116);
  });

  it('rejects products from another business', async () => {
    tx.product.findMany.mockResolvedValue([]);
    await expect(svc.create('biz-A', { items: [{ productId: prod.id, quantity: 1 }] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects insufficient stock (guarded decrement)', async () => {
    tx.inventory.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.create('biz-A', { items: [{ productId: prod.id, quantity: 99 }] })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects invalid status transitions', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'o', status: 'NEW', items: [], payments: [] });
    await expect(svc.setStatus('biz-A', 'o', 'COMPLETED')).rejects.toBeInstanceOf(BadRequestException);
  });
});
