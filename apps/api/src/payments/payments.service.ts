import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, NotImplementedException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { fromCents, toCents } from '../orders/order-logic';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDERS, PaymentProvider } from './payment-provider';

const ONLINE: PaymentMethod[] = ['CARD', 'PAYMENT_LINK', 'CHECKOUT'];

@Injectable()
export class PaymentsService {
  private log = new Logger('Payments');
  constructor(private prisma: PrismaService, @Inject(PAYMENT_PROVIDERS) private providers: Map<string, PaymentProvider>, private notifications?: NotificationsService) {}

  list(businessId: string, orderId?: string) {
    return this.prisma.payment.findMany({ where: { businessId, ...(orderId && { orderId }) }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  /** Creates a PENDING payment for an order. Amount is always the order total minus what's already paid. */
  async create(businessId: string, orderId: string, method: PaymentMethod) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, businessId }, include: { payments: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (['CANCELLED', 'REFUNDED'].includes(order.status)) throw new BadRequestException('El pedido no admite pagos');

    const paid = order.payments.filter((p) => p.status === 'SUCCEEDED').reduce((s, p) => s + toCents(p.amount), 0);
    const due = toCents(order.total) - paid;
    if (due <= 0) throw new ConflictException('El pedido ya está pagado');
    if (order.payments.some((p) => p.status === 'PENDING' && p.method === method)) throw new ConflictException('Ya hay un pago pendiente con ese método');

    const payment = await this.prisma.payment.create({
      data: { businessId, orderId, method, amount: fromCents(due), currency: 'MXN' },
    });
    if (!ONLINE.includes(method)) return { payment, checkoutUrl: null }; // in-store / transfer: confirmed manually by staff

    const provider = this.providers.get(process.env.PAYMENT_PROVIDER ?? 'mock');
    if (!provider) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw new NotImplementedException('No hay un proveedor de pagos configurado');
    }
    const session = await provider.createCheckout({ paymentId: payment.id, amountCents: due, currency: 'MXN', description: `Pedido ${orderId}` });
    const updated = await this.prisma.payment.update({
      where: { id: payment.id }, data: { provider: provider.name, providerPaymentId: session.providerPaymentId },
    });
    return { payment: updated, checkoutUrl: session.checkoutUrl };
  }

  /** Staff confirms cash / in-store / bank transfer. Online payments can only be confirmed by webhook. */
  async confirmManual(businessId: string, paymentId: string) {
    const p = await this.prisma.payment.findFirst({ where: { id: paymentId, businessId } });
    if (!p) throw new NotFoundException('Pago no encontrado');
    if (ONLINE.includes(p.method)) throw new BadRequestException('Los pagos en línea se confirman solo por webhook');
    return this.markSucceeded(p.id, businessId);
  }

  /**
   * Webhook entry point. Trust comes ONLY from the verified signature.
   * Idempotent: a repeated provider event id is acknowledged and ignored.
   */
  async handleWebhook(providerName: string, rawBody: Buffer, signature?: string) {
    const provider = this.providers.get(providerName);
    if (!provider) throw new NotFoundException();
    const ev = provider.parseWebhook(rawBody, signature); // throws 401 if signature is invalid

    try {
      await this.prisma.webhookEvent.create({ data: { provider: providerName, externalId: ev.id, type: ev.type, payload: JSON.parse(rawBody.toString('utf8')) } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { received: true, duplicate: true };
      throw e;
    }

    const payment = await this.prisma.payment.findFirst({ where: { provider: providerName, providerPaymentId: ev.providerPaymentId } });
    if (!payment) { this.log.warn(`webhook for unknown payment ${ev.providerPaymentId}`); return { received: true }; }

    if (ev.type === 'payment.succeeded') {
      // Never mark paid if the amount doesn't match what we asked for.
      if (ev.amountCents !== toCents(payment.amount) || ev.currency !== payment.currency) {
        this.log.error(`amount mismatch on payment ${payment.id}`);
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
        return { received: true };
      }
      await this.markSucceeded(payment.id, payment.businessId);
    } else if (payment.status === 'PENDING') {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    }
    await this.prisma.webhookEvent.updateMany({ where: { provider: providerName, externalId: ev.id }, data: { processedAt: new Date() } });
    return { received: true };
  }

  private async markSucceeded(paymentId: string, businessId: string) {
    let changed = false;
    const payment = await this.prisma.$transaction(async (tx) => {
      // Guarded: only PENDING -> SUCCEEDED, so replays can't double-count customer totals.
      const res = await tx.payment.updateMany({ where: { id: paymentId, businessId, status: 'PENDING' }, data: { status: 'SUCCEEDED' } });
      const payment = await tx.payment.findFirstOrThrow({ where: { id: paymentId, businessId } });
      if (res.count === 0 || !payment.orderId) return payment;
      changed = true;

      const order = await tx.order.findFirstOrThrow({ where: { id: payment.orderId, businessId }, include: { payments: true } });
      const paid = order.payments.filter((p) => p.status === 'SUCCEEDED').reduce((s, p) => s + toCents(p.amount), 0);
      if (paid >= toCents(order.total)) {
        if (order.status === 'NEW') await tx.order.update({ where: { id: order.id }, data: { status: 'CONFIRMED' } });
        if (order.customerId) {
          await tx.customer.update({
            where: { id: order.customerId },
            data: { totalSpent: { increment: order.total }, ordersCount: { increment: 1 }, lastPurchaseAt: new Date() },
          });
        }
      }
      return payment;
    });
    if (changed) void this.notifyPaid(businessId, payment).catch(() => undefined);
    return payment;
  }

  private async notifyPaid(businessId: string, payment: { orderId: string | null; amount: unknown }) {
    const n = this.notifications;
    if (!n || !payment.orderId) return;
    const order = await this.prisma.order.findFirst({ where: { id: payment.orderId, businessId }, include: { customer: true, business: true } as any }) as any;
    if (!order) return;
    await n.internal(businessId, 'payment.succeeded', 'Pago recibido', `Pedido ${order.id.slice(0, 8)} · $${payment.amount}`);
    await n.sendEmail(businessId, order.customer?.email, 'payment_confirmed', { business: order.business.name, orderId: order.id, amount: String(payment.amount) });
  }
}
