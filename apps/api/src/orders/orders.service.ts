import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, ListOrdersQuery } from './orders.dto';
import { canTransition, computeTotals, fromCents } from './order-logic';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async list(businessId: string, q: ListOrdersQuery) {
    const where: Prisma.OrderWhereInput = { businessId, ...(q.status && { status: q.status }) };
    const page = q.page ?? 1, pageSize = q.pageSize ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({ where, include: { customer: true, items: true, payments: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(businessId: string, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, businessId }, include: { customer: true, items: true, payments: true } });
    if (!o) throw new NotFoundException('Pedido no encontrado');
    return o;
  }

  /**
   * Prices, names and tax are read from the DB — never trusted from the client.
   * Stock is decremented atomically with a guarded UPDATE so concurrent orders can't oversell.
   */
  async create(businessId: string, dto: CreateOrderDto) {
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    if (ids.length !== dto.items.length) throw new BadRequestException('Productos duplicados en el pedido');

    return this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        const c = await tx.customer.findFirst({ where: { id: dto.customerId, businessId, deletedAt: null } });
        if (!c) throw new BadRequestException('Cliente inválido');
      }
      const products = await tx.product.findMany({ where: { id: { in: ids }, businessId, deletedAt: null, status: 'ACTIVE' } });
      if (products.length !== ids.length) throw new BadRequestException('Uno o más productos no existen o están inactivos');
      const byId = new Map(products.map((p) => [p.id, p]));

      for (const item of dto.items) {
        const res = await tx.inventory.updateMany({
          where: { productId: item.productId, businessId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (res.count !== 1) throw new ConflictException(`Stock insuficiente para "${byId.get(item.productId)!.name}"`);
      }

      const totals = computeTotals(
        dto.items.map((i) => ({ unitPrice: Number(byId.get(i.productId)!.price), quantity: i.quantity, taxRate: Number(byId.get(i.productId)!.taxRate) })),
        dto.discount ?? 0,
      );
      return tx.order.create({
        data: {
          businessId, customerId: dto.customerId,
          subtotal: fromCents(totals.subtotal), tax: fromCents(totals.tax), discount: fromCents(totals.discount), total: fromCents(totals.total),
          items: { create: dto.items.map((i) => ({ businessId, productId: i.productId, name: byId.get(i.productId)!.name, quantity: i.quantity, unitPrice: byId.get(i.productId)!.price })) },
        },
        include: { items: true },
      });
    });
  }

  async setStatus(businessId: string, id: string, to: OrderStatus) {
    const order = await this.get(businessId, id);
    if (!canTransition(order.status, to)) throw new BadRequestException(`No se puede pasar de ${order.status} a ${to}`);

    return this.prisma.$transaction(async (tx) => {
      // Guarded update: only applies if the status is still what we validated (no double transitions).
      const res = await tx.order.updateMany({ where: { id, businessId, status: order.status }, data: { status: to } });
      if (res.count !== 1) throw new ConflictException('El pedido cambió, intenta de nuevo');

      if (to === 'CANCELLED') {
        // Return reserved stock.
        for (const it of order.items) {
          if (it.productId) await tx.inventory.updateMany({ where: { productId: it.productId, businessId }, data: { stock: { increment: it.quantity } } });
        }
      }
      if (to === 'REFUNDED') {
        await tx.payment.updateMany({ where: { orderId: id, businessId, status: 'SUCCEEDED' }, data: { status: 'REFUNDED' } });
      }
      return tx.order.findFirstOrThrow({ where: { id, businessId }, include: { items: true, payments: true } });
    });
  }
}
