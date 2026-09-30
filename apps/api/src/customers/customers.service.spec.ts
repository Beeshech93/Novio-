import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const prisma: any = {
    customer: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
    order: { findMany: jest.fn() },
  };
  const svc = new CustomersService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('list is tenant-scoped and supports inactivity segmentation', async () => {
    await svc.list('biz-A', { inactiveDays: 60, tag: 'VIP' });
    const where = prisma.customer.findMany.mock.calls[0][0].where;
    expect(where.businessId).toBe('biz-A');
    expect(JSON.stringify(where.AND)).toContain('lastPurchaseAt');
    expect(JSON.stringify(where.AND)).toContain('"tag":"vip"');
  });

  it('history 404s for a customer of another business', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(svc.history('biz-A', 'c-of-B')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  it('create normalizes and dedupes tags', async () => {
    await svc.create('biz-A', { name: 'Ana', tags: ['VIP', ' vip ', 'Frecuente'] });
    const tags = prisma.customer.create.mock.calls[0][0].data.tags.create;
    expect(tags).toEqual([{ tag: 'vip', businessId: 'biz-A' }, { tag: 'frecuente', businessId: 'biz-A' }]);
  });
});
