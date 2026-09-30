import { UnauthorizedException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { CheckoutSession, PaymentProvider, ProviderEvent } from './payment-provider';

/**
 * Development/test provider with real HMAC-SHA256 webhook signing (same scheme most
 * processors use). NEVER enabled in production (see PaymentsModule wiring).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  constructor(private secret: string) {}

  async createCheckout(input: { paymentId: string; amountCents: number }): Promise<CheckoutSession> {
    const providerPaymentId = `mock_${randomUUID()}`;
    return { providerPaymentId, checkoutUrl: `https://checkout.mock.invalid/pay/${providerPaymentId}?amount=${input.amountCents}` };
  }

  sign(body: Buffer | string) {
    return createHmac('sha256', this.secret).update(body).digest('hex');
  }

  parseWebhook(rawBody: Buffer, signature?: string): ProviderEvent {
    const expected = Buffer.from(this.sign(rawBody), 'hex');
    const given = Buffer.from(signature ?? '', 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException('Firma inválida');
    const b = JSON.parse(rawBody.toString('utf8'));
    return { id: b.id, type: b.type, providerPaymentId: b.data.paymentId, amountCents: b.data.amountCents, currency: b.data.currency };
  }
}
