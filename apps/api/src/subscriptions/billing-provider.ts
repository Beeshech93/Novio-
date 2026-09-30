/** Subscription billing processor (Stripe, Mercado Pago, Conekta...). Left unconnected: an admin wires it in. */
export interface BillingEvent {
  id: string;
  type: 'subscription.created' | 'subscription.updated' | 'subscription.cancelled' | 'payment.failed';
  providerSubscriptionId: string;
  providerCustomerId?: string;
  /** Present on created/updated. */
  periodStart?: Date;
  periodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  /** Our own ids echoed back from checkout metadata. */
  businessId?: string;
  planId?: string;
}

export interface BillingProvider {
  readonly name: string;
  createCheckout(input: { businessId: string; planId: string; planName: string; amountCents: number; currency: string; interval: 'MONTHLY' | 'YEARLY'; successUrl: string; cancelUrl: string }): Promise<{ checkoutUrl: string }>;
  /** Verify signature over the RAW body; throw 401 if invalid. */
  /** Return null for events we don't act on: they are acknowledged (2xx) and ignored. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): BillingEvent | null;
  cancelAtPeriodEnd?(providerSubscriptionId: string, cancel: boolean): Promise<void>;
}

export const BILLING_PROVIDERS = 'BILLING_PROVIDERS';
