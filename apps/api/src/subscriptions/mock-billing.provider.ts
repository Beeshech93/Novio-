import { UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { BillingEvent, BillingProvider } from './billing-provider';

/** Dev/test only (never registered in production). Same HMAC scheme as real processors. */
export class MockBillingProvider implements BillingProvider {
  readonly name = 'mock';
  constructor(private secret: string) {}

  async createCheckout(i: { businessId: string; planId: string; amountCents: number }) {
    return { checkoutUrl: `https://billing.mock.invalid/checkout?business=${i.businessId}&plan=${i.planId}&amount=${i.amountCents}` };
  }
  sign(body: Buffer | string) { return createHmac('sha256', this.secret).update(body).digest('hex'); }

  parseWebhook(raw: Buffer, signature?: string): BillingEvent {
    const exp = Buffer.from(this.sign(raw), 'hex');
    const got = Buffer.from(signature ?? '', 'hex');
    if (got.length !== exp.length || !timingSafeEqual(got, exp)) throw new UnauthorizedException('Firma inválida');
    const b = JSON.parse(raw.toString('utf8'));
    return {
      id: b.id, type: b.type, providerSubscriptionId: b.data.subscriptionId, providerCustomerId: b.data.customerId,
      periodStart: b.data.periodStart && new Date(b.data.periodStart), periodEnd: b.data.periodEnd && new Date(b.data.periodEnd),
      cancelAtPeriodEnd: b.data.cancelAtPeriodEnd, businessId: b.data.businessId, planId: b.data.planId,
    };
  }
}
