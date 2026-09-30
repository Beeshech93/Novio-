import { SubscriptionStatus } from '@prisma/client';

export const FEATURES = [
  'website', 'products', 'customers', 'orders', 'appointments', 'whatsapp', 'invoices',
  'analytics', 'automation', 'marketing', 'inventory', 'ecommerce', 'advanced_reports',
] as const;
export type Feature = (typeof FEATURES)[number];

export const PAST_DUE_GRACE_DAYS = 3;
export const TRIAL_DAYS = 14;

interface Sub { status: SubscriptionStatus; currentPeriodEnd: Date | null }

/**
 * Whether a subscription currently grants access. The backend enforces this —
 * hiding buttons in the frontend is never the only protection.
 * A null period end means "no expiry" (manual assignment by an admin).
 */
export function hasAccess(sub: Sub | null | undefined, now = new Date()): boolean {
  if (!sub) return false;
  const end = sub.currentPeriodEnd?.getTime();
  switch (sub.status) {
    case 'active':
    case 'trialing':
      return end === undefined || end > now.getTime();
    case 'past_due':
      return end !== undefined && end + PAST_DUE_GRACE_DAYS * 86_400_000 > now.getTime();
    default:
      return false; // paused, cancelled, expired
  }
}

export function addPeriod(from: Date, interval: 'MONTHLY' | 'YEARLY'): Date {
  const d = new Date(from);
  if (interval === 'MONTHLY') d.setMonth(d.getMonth() + 1); else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export const monthlyCents = (priceCents: number, interval: 'MONTHLY' | 'YEARLY') =>
  interval === 'YEARLY' ? Math.round(priceCents / 12) : priceCents;
