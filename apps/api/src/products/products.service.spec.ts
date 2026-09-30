import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService tenant scoping', () => {
  const prisma: any = {
    product: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
    productCategory: { findFirst: jest.fn(), upsert: jest.fn() },
  };
  const svc = new ProductsService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('list always filters by businessId and excludes soft-deleted', async () => {
    await svc.list('biz-A', { q: 'corte' });
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ businessId: 'biz-A', deletedAt: null });
  });

  it("get returns 404 for another business's product", async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(svc.get('biz-A', 'p-of-B')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'p-of-B', businessId: 'biz-A' });
  });

  it('rejects a categoryId from another business', async () => {
    prisma.productCategory.findFirst.mockResolvedValue(null);
    await expect(svc.create('biz-A', { name: 'x', price: 1, categoryId: 'cat-of-B' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('create attaches business and inventory', async () => {
    prisma.product.create.mockResolvedValue({ id: 'p1' });
    await svc.create('biz-A', { name: 'Gel', price: 50, stock: 5, minStock: 2 });
    const data = prisma.product.create.mock.calls[0][0].data;
    expect(data.businessId).toBe('biz-A');
    expect(data.inventory.create).toEqual({ businessId: 'biz-A', stock: 5, minStock: 2 });
  });

  it('import reports bad rows and creates good ones', async () => {
    prisma.product.create.mockResolvedValue({ id: 'p1' });
    const res = await svc.importCsv('biz-A', 'name,price\nGel,50\n,10\nCera,abc\n');
    expect(res.created).toBe(1);
    expect(res.errors.map((e) => e.row)).toEqual([3, 4]);
  });
});
