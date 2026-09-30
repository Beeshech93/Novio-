/**
 * Abstraction over external payment processors. Card data never touches Nuvio:
 * the provider hosts the checkout and notifies us by webhook.
 */
export interface CheckoutSession {
  providerPaymentId: string;
  checkoutUrl: string;
}

export interface ProviderEvent {
  /** Provider's unique event id — used for idempotency. */
  id: string;
  type: 'payment.succeeded' | 'payment.failed';
  providerPaymentId: string;
  amountCents: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: { paymentId: string; amountCents: number; currency: string; description: string }): Promise<CheckoutSession>;
  /** Must verify the signature over the RAW body and throw if invalid. */
  /** Return null for events we don't act on: they are acknowledged (2xx) and ignored. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): ProviderEvent | null;
}

export const PAYMENT_PROVIDERS = 'PAYMENT_PROVIDERS';
