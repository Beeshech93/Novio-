import { CheckoutSession, PaymentProvider, ProviderEvent } from './payment-provider';
import { stripePost, verifyStripeSignature, webOrigin } from './stripe';

/**
 * Stripe Checkout (hosted page) for order payments. Card data never touches Nuvio.
 * Payment is confirmed ONLY by a signed `checkout.session.completed` webhook with payment_status=paid.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  constructor(private secretKey: string, private webhookSecret: string, private fetchImpl: typeof fetch = fetch) {}

  async createCheckout(i: { paymentId: string; amountCents: number; currency: string; description: string }): Promise<CheckoutSession> {
    const s = await stripePost<{ id: string; url: string }>(this.secretKey, 'checkout/sessions', {
      mode: 'payment',
      success_url: `${webOrigin()}/dashboard/pedidos?pago=ok`,
      cancel_url: `${webOrigin()}/dashboard/pedidos?pago=cancelado`,
      client_reference_id: i.paymentId,
      metadata: { paymentId: i.paymentId },
      line_items: [{ quantity: 1, price_data: { currency: i.currency.toLowerCase(), unit_amount: i.amountCents, product_data: { name: i.description.slice(0, 120) } } }],
    }, `nuvio-pay-${i.paymentId}`, this.fetchImpl);
    return { providerPaymentId: s.id, checkoutUrl: s.url };
  }

  /** Returns null for events this provider doesn't handle (subscriptions, etc.): acknowledged and ignored. */
  parseWebhook(raw: Buffer, signature: string | undefined): ProviderEvent | null {
    verifyStripeSignature(raw, signature, this.webhookSecret);
    const ev = JSON.parse(raw.toString('utf8'));
    const o = ev?.data?.object;
    if (!o || o.mode !== 'payment') return null;
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
      if (o.payment_status !== 'paid') return null; // completed but not yet paid (async methods): wait for the success event
      return { id: ev.id, type: 'payment.succeeded', providerPaymentId: o.id, amountCents: o.amount_total, currency: String(o.currency).toUpperCase() };
    }
    if (ev.type === 'checkout.session.async_payment_failed' || ev.type === 'checkout.session.expired') {
      return { id: ev.id, type: 'payment.failed', providerPaymentId: o.id, amountCents: o.amount_total ?? 0, currency: String(o.currency ?? '').toUpperCase() };
    }
    return null;
  }
}
