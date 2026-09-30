import { NotImplementedException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MockBillingProvider } from './mock-billing.provider';
import { SubscriptionsService } from './subscriptions.service';

const provider = new MockBillingProvider('k');
const raw = (over: any = {}) => Buffer.from(JSON.stringify({
  id: 'evt1', type: 'subscription.created',
  data: { subscriptionId: 'sub_1', businessId: 'b1', planId: 'plan1', periodStart: '2026-06-01T00:00:00Z', periodEnd: '2026-07-01T00:00:00Z' }, ...over,
}));

describe('SubscriptionsService', () => {
  const prisma: any = {
    webhookEvent: { create: jest.fn(), updateMany: jest.fn() },
    subscription: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    plan: { findUnique: jest.fn(), findFirst: jest.fn() },
  };
  const svc = new SubscriptionsService(prisma, new Map([['mock', provider]]));
  beforeEach(() => { jest.clearAllMocks(); prisma.webhookEvent.create.mockResolvedValue({}); prisma.subscription.findFirst.mockResolvedValue(null); prisma.plan.findUnique.mockResolvedValue({ id: 'plan1', billingInterval: 'MONTHLY' }); });

  it('rejects bad signatures before touching the DB', async () => {
    await expect(svc.handleWebhook('mock', raw(), 'nope')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
  });

  it('creates an active subscription from a verified created event', async () => {
    const b = raw(); await svc.handleWebhook('mock', b, provider.sign(b));
    expect(prisma.subscription.create.mock.calls[0][0].data).toMatchObject({ businessId: 'b1', planId: 'plan1', status: 'active', provider: 'mock' });
  });

  it('is idempotent on duplicate event ids', async () => {
    prisma.webhookEvent.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('d', { code: 'P2002', clientVersion: 'x' }));
    const b = raw();
    expect(await svc.handleWebhook('mock', b, provider.sign(b))).toEqual({ received: true, duplicate: true });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('cancelled event marks the subscription cancelled (data kept)', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 's1' });
    const b = raw({ type: 'subscription.cancelled' }); await svc.handleWebhook('mock', b, provider.sign(b));
    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'cancelled' } });
  });

  it('checkout says clearly when no provider is connected', async () => {
    const bare = new SubscriptionsService(prisma, new Map());
    prisma.plan.findFirst.mockResolvedValue({ id: 'plan1', price: '199.00', name: 'x', currency: 'MXN' });
    await expect(bare.startCheckout('b1', 'basico', 'MONTHLY')).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('features() is empty without a valid subscription', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ status: 'cancelled', currentPeriodEnd: null, plan: { features: ['products'] } });
    expect(await svc.features('b1')).toEqual([]);
    prisma.subscription.findFirst.mockResolvedValue({ status: 'active', currentPeriodEnd: null, plan: { features: ['products'] } });
    expect(await svc.features('b1')).toEqual(['products']);
  });
});
