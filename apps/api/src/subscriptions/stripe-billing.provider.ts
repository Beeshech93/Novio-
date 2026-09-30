import { stripePost, verifyStripeSignature, webOrigin } from '../payments/stripe';
import { BillingEvent, BillingProvider } from './billing-provider';

const sec = (n?: number) => (typeof n === 'number' ? new Date(n * 1000) : undefined);

/** Stripe Billing via Checkout in subscription mode. Subscriptions are activated only from signed webhooks. */
export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe';
  constructor(private secretKey: string, private webhookSecret: string, private fetchImpl: typeof fetch = fetch) {}

  async createCheckout(i: { businessId: string; planId: string; planName: string; amountCents: number; currency: string; interval: 'MONTHLY' | 'YEARLY'; successUrl: string; cancelUrl: string }) {
    const meta = { businessId: i.businessId, planId: i.planId };
    const s = await stripePost<{ url: string }>(this.secretKey, 'checkout/sessions', {
      mode: 'subscription',
      success_url: i.successUrl,
      cancel_url: i.cancelUrl,
      client_reference_id: i.businessId,
      metadata: meta,
      subscription_data: { metadata: meta }, // copied onto the Subscription so later events still know the business/plan
      line_items: [{ quantity: 1, price_data: { currency: i.currency.toLowerCase(), unit_amount: i.amountCents, recurring: { interval: i.interval === 'YEARLY' ? 'year' : 'month' }, product_data: { name: i.planName } } }],
    }, undefined, this.fetchImpl);
    return { checkoutUrl: s.url };
  }

  async cancelAtPeriodEnd(subscriptionId: string, cancel: boolean) {
    await stripePost(this.secretKey, `subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: cancel }, undefined, this.fetchImpl);
  }

  parseWebhook(raw: Buffer, signature: string | undefined): BillingEvent | null {
    verifyStripeSignature(raw, signature, this.webhookSecret);
    const ev = JSON.parse(raw.toString('utf8'));
    const o = ev?.data?.object;
    if (!o) return null;

    switch (ev.type) {
      case 'checkout.session.completed':
        if (o.mode !== 'subscription' || !o.subscription) return null;
        return { id: ev.id, type: 'subscription.created', providerSubscriptionId: o.subscription, providerCustomerId: o.customer, businessId: o.metadata?.businessId, planId: o.metadata?.planId };
      case 'customer.subscription.updated': {
        // Period fields moved onto the first item in newer API versions; accept both.
        const item = o.items?.data?.[0];
        return {
          id: ev.id, type: 'subscription.updated', providerSubscriptionId: o.id, providerCustomerId: o.customer,
          periodStart: sec(o.current_period_start ?? item?.current_period_start), periodEnd: sec(o.current_period_end ?? item?.current_period_end),
          cancelAtPeriodEnd: !!o.cancel_at_period_end, businessId: o.metadata?.businessId, planId: o.metadata?.planId,
        };
      }
      case 'customer.subscription.deleted':
        return { id: ev.id, type: 'subscription.cancelled', providerSubscriptionId: o.id };
      case 'invoice.payment_failed': {
        const sub = o.subscription ?? o.parent?.subscription_details?.subscription;
        return sub ? { id: ev.id, type: 'payment.failed', providerSubscriptionId: sub } : null;
      }
      default:
        return null;
    }
  }
}

export { webOrigin };
