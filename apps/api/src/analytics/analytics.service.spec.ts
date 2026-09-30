import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('aggregates revenue, ticket and daily sales — all filtered by businessId', async () => {
    const prisma: any = {
      payment: { findMany: jest.fn().mockResolvedValue([
        { amount: '100.50', createdAt: new Date('2026-06-10T10:00:00Z') }, { amount: '99.50', createdAt: new Date('2026-06-10T15:00:00Z') }, { amount: '50', createdAt: new Date('2026-06-11T09:00:00Z') },
      ]) },
      order: { count: jest.fn().mockResolvedValue(3) }, customer: { count: jest.fn().mockResolvedValue(2) },
      orderItem: { groupBy: jest.fn().mockResolvedValue([{ name: 'Gel', _sum: { quantity: 7 } }]) },
      appointment: { groupBy: jest.fn().mockResolvedValue([{ serviceId: 's1', _count: { _all: 4 } }]) },
      service: { findMany: jest.fn().mockResolvedValue([{ id: 's1', name: 'Corte' }]) },
    };
    const r = await new AnalyticsService(prisma).overview('bA', '2026-06-01', '2026-06-30');
    expect(r.revenue).toBe(250);
    expect(r.averageTicket).toBeCloseTo(83.33, 1);
    expect(r.salesByDay).toEqual([{ date: '2026-06-10', total: 200 }, { date: '2026-06-11', total: 50 }]);
    expect(r.topProducts).toEqual([{ name: 'Gel', quantity: 7 }]);
    expect(r.topServices).toEqual([{ name: 'Corte', appointments: 4 }]);
    for (const m of [prisma.payment.findMany, prisma.order.count, prisma.customer.count, prisma.orderItem.groupBy, prisma.appointment.groupBy]) {
      expect(m.mock.calls[0][0].where.businessId).toBe('bA');
    }
  });
});
