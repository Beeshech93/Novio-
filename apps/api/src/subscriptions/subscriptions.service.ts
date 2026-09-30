import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, NotImplementedException } from '@nestjs/common';
import { BillingInterval, Prisma } from '@prisma/client';
import { toCents } from '../orders/order-logic';
import { PrismaService } from '../prisma/prisma.service';
import { addPeriod, Feature, hasAccess } from './access';
import { BILLING_PROVIDERS, BillingProvider } from './billing-provider';

@Injectable()
export class SubscriptionsService {
  private log = new Logger('Subscriptions');
  constructor(private prisma: PrismaService, @Inject(BILLING_PROVIDERS) private providers: Map<string, BillingProvider>) {}

  current(businessId: string) {
    return this.prisma.subscription.findFirst({ where: { businessId }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
  }

  /** Features unlocked right now for this business (empty when there's no valid subscription). */
  async features(businessId: string): Promise<Feature[]> {
    const sub = await this.current(businessId);
    return hasAccess(sub) ? ((sub!.plan.features as unknown as Feature[]) ?? []) : [];
  }

  async startCheckout(businessId: string, planSlug: string, interval: BillingInterval) {
    // The price is read from the DB plan row — the client only chooses slug + interval.
    const plan = await this.prisma.plan.findFirst({ where: { slug: planSlug, billingInterval: interval, active: true } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    const provider = this.providers.get(process.env.BILLING_PROVIDER ?? (this.providers.has('stripe') ? 'stripe' : 'mock'));
    if (!provider) throw new NotImplementedException('No hay un proveedor de cobro conectado todavía');
    const web = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',')[0];
    return provider.createCheckout({
      businessId, planId: plan.id, planName: plan.name, amountCents: toCents(plan.price), currency: plan.currency, interval,
      successUrl: `${web}/dashboard?billing=success`, cancelUrl: `${web}/dashboard?billing=cancelled`,
    });
  }

  /** Cancel at period end — never delete data, the business keeps access until the period closes. */
  async setCancelAtPeriodEnd(businessId: string, cancel: boolean) {
    const sub = await this.current(businessId);
    if (!sub || !['active', 'trialing', 'past_due'].includes(sub.status)) throw new BadRequestException('No hay una suscripción activa');
    const provider = sub.provider ? this.providers.get(sub.provider) : undefined;
    if (provider?.cancelAtPeriodEnd && sub.providerSubscriptionId) await provider.cancelAtPeriodEnd(sub.providerSubscriptionId, cancel);
    return this.prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: cancel } });
  }

  /** Webhook: signature-verified, idempotent, keyed on provider event id. */
  async handleWebhook(providerName: string, raw: Buffer, signature?: string) {
    const provider = this.providers.get(providerName);
    if (!provider) throw new NotFoundException();
    const ev = provider.parseWebhook(raw, signature);
    if (!ev) return { received: true, ignored: true };

    try {
      await this.prisma.webhookEvent.create({ data: { provider: `billing:${providerName}`, externalId: ev.id, type: ev.type, payload: JSON.parse(raw.toString('utf8')) } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { received: true, duplicate: true };
      throw e;
    }

    const existing = await this.prisma.subscription.findFirst({ where: { provider: providerName, providerSubscriptionId: ev.providerSubscriptionId } });

    if (ev.type === 'subscription.created' || ev.type === 'subscription.updated') {
      if (existing) {
        await this.prisma.subscription.update({
          where: { id: existing.id },
          data: {
            status: 'active', currentPeriodStart: ev.periodStart, currentPeriodEnd: ev.periodEnd,
            ...(ev.cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd: ev.cancelAtPeriodEnd }),
            ...(ev.planId && { planId: ev.planId }),
          },
        });
      } else {
        if (!ev.businessId || !ev.planId) { this.log.warn('created event without business/plan metadata'); return { received: true }; }
        const plan = await this.prisma.plan.findUnique({ where: { id: ev.planId } });
        if (!plan) return { received: true };
        await this.prisma.subscription.create({
          data: {
            businessId: ev.businessId, planId: plan.id, provider: providerName, providerSubscriptionId: ev.providerSubscriptionId,
            providerCustomerId: ev.providerCustomerId, status: 'active', billingInterval: plan.billingInterval,
            currentPeriodStart: ev.periodStart ?? new Date(), currentPeriodEnd: ev.periodEnd ?? addPeriod(new Date(), plan.billingInterval),
          },
        });
      }
    } else if (existing) {
      await this.prisma.subscription.update({ where: { id: existing.id }, data: { status: ev.type === 'subscription.cancelled' ? 'cancelled' : 'past_due' } });
    }
    await this.prisma.webhookEvent.updateMany({ where: { provider: `billing:${providerName}`, externalId: ev.id }, data: { processedAt: new Date() } });
    return { received: true };
  }

  /** Manual assignment by a platform admin (used while no billing provider is connected). */
  async assign(businessId: string, planSlug: string, interval: BillingInterval, opts: { status?: 'active' | 'trialing'; days?: number } = {}) {
    const [business, plan] = await Promise.all([
      this.prisma.business.findFirst({ where: { id: businessId, deletedAt: null } }),
      this.prisma.plan.findFirst({ where: { slug: planSlug, billingInterval: interval } }),
    ]);
    if (!business) throw new NotFoundException('Negocio no encontrado');
    if (!plan) throw new NotFoundException('Plan no encontrado');
    const now = new Date();
    const end = opts.days ? new Date(now.getTime() + opts.days * 86_400_000) : addPeriod(now, interval);
    return this.prisma.$transaction(async (tx) => {
      // One live subscription per business: retire previous ones.
      await tx.subscription.updateMany({ where: { businessId, status: { in: ['active', 'trialing', 'past_due', 'paused'] } }, data: { status: 'cancelled' } });
      return tx.subscription.create({
        data: { businessId, planId: plan.id, provider: 'manual', status: opts.status ?? 'active', billingInterval: interval, currentPeriodStart: now, currentPeriodEnd: end },
        include: { plan: true },
      });
    });
  }
}
