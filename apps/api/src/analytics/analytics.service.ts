import { Injectable } from '@nestjs/common';
import { toCents } from '../orders/order-logic';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /** `from`/`to` are YYYY-MM-DD (UTC day bounds). Default: last 30 days. */
  async overview(businessId: string, from?: string, to?: string, now = new Date()) {
    const end = to ? new Date(`${to}T23:59:59.999Z`) : now;
    const start = from ? new Date(`${from}T00:00:00Z`) : new Date(end.getTime() - 30 * 86_400_000);
    const range = { gte: start, lte: end };

    const [payments, ordersCount, newCustomers, recurring, items, appts] = await Promise.all([
      this.prisma.payment.findMany({ where: { businessId, status: 'SUCCEEDED', createdAt: range }, select: { amount: true, createdAt: true }, take: 10000 }),
      this.prisma.order.count({ where: { businessId, createdAt: range, status: { notIn: ['CANCELLED'] } } }),
      this.prisma.customer.count({ where: { businessId, deletedAt: null, createdAt: range } }),
      this.prisma.customer.count({ where: { businessId, deletedAt: null, ordersCount: { gt: 1 } } }),
      this.prisma.orderItem.groupBy({ by: ['productId', 'name'], where: { businessId, order: { createdAt: range, status: { notIn: ['CANCELLED'] } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
      this.prisma.appointment.groupBy({ by: ['serviceId'], where: { businessId, startAt: range, status: { in: ['confirmed', 'completed'] } }, _count: { _all: true }, orderBy: { _count: { serviceId: 'desc' } }, take: 5 }),
    ]);

    const revenueCents = payments.reduce((s, p) => s + toCents(p.amount), 0);
    const byDay = new Map<string, number>();
    for (const p of payments) { const d = p.createdAt.toISOString().slice(0, 10); byDay.set(d, (byDay.get(d) ?? 0) + toCents(p.amount)); }

    const services = await this.prisma.service.findMany({ where: { businessId, id: { in: appts.map((a) => a.serviceId).filter(Boolean) as string[] } }, select: { id: true, name: true } });
    const name = new Map(services.map((s) => [s.id, s.name]));

    return {
      range: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
      revenue: revenueCents / 100,
      orders: ordersCount,
      averageTicket: payments.length ? revenueCents / payments.length / 100 : 0,
      newCustomers, recurringCustomers: recurring,
      salesByDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, c]) => ({ date, total: c / 100 })),
      topProducts: items.map((i) => ({ name: i.name, quantity: i._sum.quantity ?? 0 })),
      topServices: appts.map((a) => ({ name: name.get(a.serviceId ?? '') ?? 'Servicio', appointments: a._count._all })),
    };
  }
}
