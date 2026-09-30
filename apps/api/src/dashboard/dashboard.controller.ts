import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get('summary')
  async summary(@Tenant() t: TenantContext) {
    const b = t.businessId;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paid = { businessId: b, status: 'SUCCEEDED' as const };

    const [salesToday, salesMonth, orders, newCustomers, appointments, products] = await Promise.all([
      this.prisma.payment.aggregate({ where: { ...paid, createdAt: { gte: startOfDay } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { ...paid, createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
      this.prisma.order.count({ where: { businessId: b, createdAt: { gte: startOfMonth } } }),
      this.prisma.customer.count({ where: { businessId: b, deletedAt: null, createdAt: { gte: startOfMonth } } }),
      this.prisma.appointment.count({ where: { businessId: b, startAt: { gte: startOfDay } } }),
      this.prisma.inventory.findMany({ where: { businessId: b }, select: { stock: true, minStock: true } }),
    ]);

    return {
      salesToday: Number(salesToday._sum.amount ?? 0),
      salesMonth: Number(salesMonth._sum.amount ?? 0),
      ordersMonth: orders,
      newCustomersMonth: newCustomers,
      upcomingAppointments: appointments,
      lowStockProducts: products.filter((p) => p.stock <= p.minStock).length,
    };
  }
}
