import { UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/** Stripe webhook signature: header `t=<unix>,v1=<hex>[,v1=...]`, v1 = HMAC-SHA256(secret, `${t}.${rawBody}`). */
export function verifyStripeSignature(raw: Buffer, header: string | undefined, secret: string, now = Date.now(), toleranceSec = 300): void {
  if (!header) throw new UnauthorizedException('Firma inválida');
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !/^\d+$/.test(t) || sigs.length === 0) throw new UnauthorizedException('Firma inválida');
  // Reject old timestamps: a captured webhook can't be replayed later.
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) throw new UnauthorizedException('Firma inválida');
  const expected = createHmac('sha256', secret).update(`${t}.`).update(raw).digest();
  const ok = sigs.some((s) => {
    const got = Buffer.from(s, 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!ok) throw new UnauthorizedException('Firma inválida');
}

/** Stripe's form encoding: nested keys as a[b][c]=v, arrays as a[0]=v. */
export function formEncode(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    if (v === undefined || v === null) return [];
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) return v.flatMap((x, i) => (typeof x === 'object' ? formEncode(x as Record<string, unknown>, `${key}[${i}]`) : [`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(x))}`]));
    if (typeof v === 'object') return formEncode(v as Record<string, unknown>, key);
    return [`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`];
  });
}

export async function stripePost<T>(secretKey: string, path: string, body: Record<string, unknown>, idempotencyKey?: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
    },
    body: formEncode(body).join('&'),
  });
  if (!res.ok) throw new Error(`stripe ${path} ${res.status}`); // never include the response body: it can echo request data
  return (await res.json()) as T;
}

export const webOrigin = () => (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
