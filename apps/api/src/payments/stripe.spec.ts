import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { StripeBillingProvider } from '../subscriptions/stripe-billing.provider';
import { StripePaymentProvider } from './stripe-payment.provider';
import { formEncode, verifyStripeSignature } from './stripe';

const SECRET = 'whsec_test_secret';
const NOW = 1_800_000_000_000; // ms
const sign = (raw: string, t = Math.floor(NOW / 1000), secret = SECRET) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;
const body = (o: unknown) => Buffer.from(JSON.stringify(o));

describe('Stripe signature', () => {
  const raw = '{"id":"evt_1"}';
  it('accepts a valid signature', () => expect(() => verifyStripeSignature(Buffer.from(raw), sign(raw), SECRET, NOW)).not.toThrow());
  it('rejects wrong secret, tampered body, missing/garbled header', () => {
    expect(() => verifyStripeSignature(Buffer.from(raw), sign(raw, undefined, 'other'), SECRET, NOW)).toThrow(UnauthorizedException);
    expect(() => verifyStripeSignature(Buffer.from(raw + ' '), sign(raw), SECRET, NOW)).toThrow(UnauthorizedException);
    expect(() => verifyStripeSignature(Buffer.from(raw), undefined, SECRET, NOW)).toThrow(UnauthorizedException);
    expect(() => verifyStripeSignature(Buffer.from(raw), 'garbage', SECRET, NOW)).toThrow(UnauthorizedException);
  });
  it('rejects replays older than 5 minutes', () => {
    const old = Math.floor(NOW / 1000) - 400;
    expect(() => verifyStripeSignature(Buffer.from(raw), sign(raw, old), SECRET, NOW)).toThrow(UnauthorizedException);
  });
  it('accepts when one of several v1 signatures matches (key rotation)', () => {
    const good = sign(raw);
    expect(() => verifyStripeSignature(Buffer.from(raw), `${good},v1=${'00'.repeat(32)}`, SECRET, NOW)).not.toThrow();
  });
});

describe('formEncode', () => {
  it('encodes nested objects and arrays the way Stripe expects', () => {
    const s = decodeURIComponent(formEncode({ mode: 'payment', metadata: { a: 'x y' }, line_items: [{ quantity: 1, price_data: { currency: 'mxn' } }] }).join('&'));
    expect(s).toContain('mode=payment');
    expect(s).toContain('metadata[a]=x y');
    expect(s).toContain('line_items[0][quantity]=1');
    expect(s).toContain('line_items[0][price_data][currency]=mxn');
  });
  it('skips undefined', () => expect(formEncode({ a: undefined, b: 'c' })).toEqual(['b=c']));
});

describe('StripePaymentProvider', () => {
  const p = new StripePaymentProvider('sk_test_x', SECRET);
  const event = (type: string, obj: object) => { const raw = JSON.stringify({ id: 'evt_9', type, data: { object: obj } }); return { raw: Buffer.from(raw), sig: sign(raw) }; };
  beforeAll(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
  afterAll(() => jest.restoreAllMocks());

  it('creates a hosted checkout with the amount from OUR side and returns the session id/url', async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' }) });
    const r = await new StripePaymentProvider('sk_test_x', SECRET, f as any).createCheckout({ paymentId: 'pay-1', amountCents: 11600, currency: 'MXN', description: 'Pedido abc' });
    expect(r).toEqual({ providerPaymentId: 'cs_1', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_1' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init.headers.Authorization).toBe('Bearer sk_test_x');
    expect(init.headers['Idempotency-Key']).toBe('nuvio-pay-pay-1');
    const form = decodeURIComponent(init.body);
    expect(form).toContain('line_items[0][price_data][unit_amount]=11600');
    expect(form).toContain('line_items[0][price_data][currency]=mxn');
    expect(form).toContain('metadata[paymentId]=pay-1');
  });
  it('does not leak the Stripe error body', async () => {
    const f = jest.fn().mockResolvedValue({ ok: false, status: 402, text: async () => 'secret detail' });
    await expect(new StripePaymentProvider('sk', SECRET, f as any).createCheckout({ paymentId: 'p', amountCents: 1, currency: 'MXN', description: 'x' })).rejects.toThrow(/^stripe checkout\/sessions 402$/);
  });
  it('paid session -> payment.succeeded (amount/currency taken from Stripe)', () => {
    const { raw, sig } = event('checkout.session.completed', { id: 'cs_1', mode: 'payment', payment_status: 'paid', amount_total: 11600, currency: 'mxn' });
    expect(p.parseWebhook(raw, sig)).toEqual({ id: 'evt_9', type: 'payment.succeeded', providerPaymentId: 'cs_1', amountCents: 11600, currency: 'MXN' });
  });
  it('completed-but-unpaid (async methods) is ignored until the async success arrives', () => {
    const { raw, sig } = event('checkout.session.completed', { id: 'cs_1', mode: 'payment', payment_status: 'unpaid', amount_total: 1, currency: 'mxn' });
    expect(p.parseWebhook(raw, sig)).toBeNull();
  });
  it('expired / async failure -> payment.failed', () => {
    const { raw, sig } = event('checkout.session.expired', { id: 'cs_2', mode: 'payment', amount_total: 500, currency: 'mxn' });
    expect(p.parseWebhook(raw, sig)!.type).toBe('payment.failed');
  });
  it('ignores subscription sessions and unrelated events', () => {
    expect(p.parseWebhook(...Object.values(event('checkout.session.completed', { id: 'cs_3', mode: 'subscription', payment_status: 'paid' })) as [Buffer, string])).toBeNull();
    expect(p.parseWebhook(...Object.values(event('charge.refunded', { id: 'ch_1' })) as [Buffer, string])).toBeNull();
  });
  it('rejects an unsigned/invalid webhook before parsing anything', () => {
    expect(() => p.parseWebhook(body({ id: 'x' }), 't=1,v1=00')).toThrow(UnauthorizedException);
  });
});

describe('StripeBillingProvider', () => {
  const b = new StripeBillingProvider('sk_test_x', SECRET);
  const event = (type: string, obj: object) => { const raw = JSON.stringify({ id: 'evt_5', type, data: { object: obj } }); return [Buffer.from(raw), sign(raw)] as [Buffer, string]; };
  beforeAll(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
  afterAll(() => jest.restoreAllMocks());

  it('builds a subscription checkout with recurring interval and business/plan metadata', async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_s' }) });
    await new StripeBillingProvider('sk', SECRET, f as any).createCheckout({ businessId: 'b1', planId: 'p1', planName: 'Nuvio Negocio', amountCents: 799000, currency: 'MXN', interval: 'YEARLY', successUrl: 'https://w/ok', cancelUrl: 'https://w/no' });
    const form = decodeURIComponent(f.mock.calls[0][1].body);
    expect(form).toContain('mode=subscription');
    expect(form).toContain('line_items[0][price_data][recurring][interval]=year');
    expect(form).toContain('metadata[businessId]=b1');
    expect(form).toContain('subscription_data[metadata][planId]=p1');
  });
  it('maps checkout completion, updates (both period layouts), deletion and failed invoices', () => {
    expect(b.parseWebhook(...event('checkout.session.completed', { mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', metadata: { businessId: 'b1', planId: 'p1' } }))).toMatchObject({ type: 'subscription.created', providerSubscriptionId: 'sub_1', businessId: 'b1', planId: 'p1' });
    const legacy = b.parseWebhook(...event('customer.subscription.updated', { id: 'sub_1', current_period_start: 1_800_000_000, current_period_end: 1_802_592_000, cancel_at_period_end: true }))!;
    expect(legacy).toMatchObject({ type: 'subscription.updated', cancelAtPeriodEnd: true });
    expect(legacy.periodEnd!.getTime()).toBe(1_802_592_000_000);
    const modern = b.parseWebhook(...event('customer.subscription.updated', { id: 'sub_1', items: { data: [{ current_period_start: 1_800_000_000, current_period_end: 1_802_592_000 }] } }))!;
    expect(modern.periodEnd!.getTime()).toBe(1_802_592_000_000);
    expect(b.parseWebhook(...event('customer.subscription.deleted', { id: 'sub_1' }))!.type).toBe('subscription.cancelled');
    expect(b.parseWebhook(...event('invoice.payment_failed', { subscription: 'sub_1' }))).toMatchObject({ type: 'payment.failed', providerSubscriptionId: 'sub_1' });
    expect(b.parseWebhook(...event('invoice.payment_failed', { parent: { subscription_details: { subscription: 'sub_2' } } }))!.providerSubscriptionId).toBe('sub_2');
  });
  it('ignores one-off payment sessions and unknown events', () => {
    expect(b.parseWebhook(...event('checkout.session.completed', { mode: 'payment', payment_status: 'paid' }))).toBeNull();
    expect(b.parseWebhook(...event('customer.created', { id: 'cus_1' }))).toBeNull();
  });
  it('cancel-at-period-end calls the subscription endpoint', async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await new StripeBillingProvider('sk', SECRET, f as any).cancelAtPeriodEnd('sub_1', true);
    expect(f.mock.calls[0][0]).toBe('https://api.stripe.com/v1/subscriptions/sub_1');
    expect(decodeURIComponent(f.mock.calls[0][1].body)).toBe('cancel_at_period_end=true');
  });
});
