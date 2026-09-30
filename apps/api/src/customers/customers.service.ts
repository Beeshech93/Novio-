import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerDto, ListCustomersQuery, UpdateCustomerDto } from './customers.dto';

const normalizeTags = (tags?: string[]) => [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))];

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async list(businessId: string, q: ListCustomersQuery) {
    const and: Prisma.CustomerWhereInput[] = [];
    if (q.q) {
      and.push({ OR: [
        { name: { contains: q.q, mode: 'insensitive' } },
        { email: { contains: q.q, mode: 'insensitive' } },
        { phone: { contains: q.q } },
        { whatsapp: { contains: q.q } },
      ] });
    }
    if (q.tag) and.push({ tags: { some: { tag: q.tag.toLowerCase() } } });
    if (q.inactiveDays) {
      const cutoff = new Date(Date.now() - q.inactiveDays * 86_400_000);
      and.push({ OR: [{ lastPurchaseAt: null }, { lastPurchaseAt: { lt: cutoff } }] });
    }
    const where: Prisma.CustomerWhereInput = { businessId, deletedAt: null, AND: and };
    const page = q.page ?? 1, pageSize = q.pageSize ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({ where, include: { tags: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(businessId: string, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, businessId, deletedAt: null }, include: { tags: true } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  /** Purchase history (orders) for the customer detail view. */
  async history(businessId: string, id: string) {
    await this.get(businessId, id);
    return this.prisma.order.findMany({
      where: { businessId, customerId: id }, include: { items: true }, orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  create(businessId: string, dto: CustomerDto) {
    const { tags, ...data } = dto;
    return this.prisma.customer.create({
      data: { ...data, businessId, tags: { create: normalizeTags(tags).map((tag) => ({ tag, businessId })) } },
      include: { tags: true },
    });
  }

  async update(businessId: string, id: string, dto: UpdateCustomerDto) {
    await this.get(businessId, id);
    const { tags, ...data } = dto;
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...data,
        ...(tags && { tags: { deleteMany: {}, create: normalizeTags(tags).map((tag) => ({ tag, businessId })) } }),
      },
      include: { tags: true },
    });
  }

  async remove(businessId: string, id: string) {
    await this.get(businessId, id);
    await this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
