import { ConflictException } from '@nestjs/common';
import { AutomationsService } from '../automations/automations.service';
import { MarketingService, segmentWhere } from './marketing.service';

describe('segmentWhere', () => {
  it('is always tenant-scoped and builds the inactivity filter', () => {
    const w: any = segmentWhere('bA', { inactiveDays: 60, tag: 'VIP', minSpent: 500 }, new Date('2026-06-15T00:00:00Z'));
    expect(w).toMatchObject({ businessId: 'bA', deletedAt: null });
    expect(JSON.stringify(w.AND)).toContain('"tag":"vip"');
    expect(JSON.stringify(w.AND)).toContain('2026-04-16');
  });
});

describe('MarketingService.sendCampaign', () => {
  const mk = () => {
    const prisma: any = {
      campaign: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', channel: 'whatsapp', message: 'Hola {{customer.name}}', name: 'N', segment: { inactiveDays: 60 } }), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockImplementation(async (a: any) => a.data) },
      business: { findFirstOrThrow: jest.fn().mockResolvedValue({ name: 'Barbería' }) },
      customer: { findMany: jest.fn().mockResolvedValue([{ name: 'Ana', whatsapp: '+5215512345678' }, { name: 'Luis', phone: '+5215587654321' }]) },
    };
    const notifications: any = { sendWhatsApp: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false), sendEmail: jest.fn() };
    return { prisma, notifications, svc: new MarketingService(prisma, notifications) };
  };

  it('only targets opted-in customers of that business and counts results', async () => {
    const { svc, prisma, notifications } = mk();
    const res: any = await svc.sendCampaign('bA', 'c1');
    expect(prisma.customer.findMany.mock.calls[0][0].where).toMatchObject({ businessId: 'bA', marketingOptIn: true });
    expect(notifications.sendWhatsApp.mock.calls[0][3].message).toBe('Hola Ana');
    expect(res).toMatchObject({ status: 'sent', sentCount: 1, failedCount: 1 });
  });

  it('cannot be sent twice (claim is guarded by status=draft)', async () => {
    const { svc, prisma } = mk();
    prisma.campaign.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.sendCampaign('bA', 'c1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });
});

describe('AutomationsService', () => {
  const mk = (actions: any[] = [{ type: 'send_whatsapp', config: { message: 'Hola {{customer.name}}' } }, { type: 'internal_notification', config: { title: 'T', message: 'm' } }]) => {
    const prisma: any = {
      automation: { findMany: jest.fn().mockResolvedValue([{ id: 'a1', triggers: [{ condition: { conditions: [{ field: 'payment.amount', op: 'gte', value: 100 }] } }], actions }]) },
      business: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'bA', name: 'B' }) },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', name: 'Ana', whatsapp: '+521555', marketingOptIn: true, tags: [] }) },
      automationRun: { create: jest.fn().mockResolvedValue({}) },
    };
    const n: any = { sendWhatsApp: jest.fn(), sendEmail: jest.fn(), internal: jest.fn() };
    return { prisma, n, svc: new AutomationsService(prisma, n) };
  };

  it('runs actions when conditions match', async () => {
    const { svc, n, prisma } = mk();
    expect(await svc.fire('bA', 'payment.succeeded', 'payment:1', { customerId: 'c1', payment: { amount: 250 } })).toBe(1);
    expect(n.sendWhatsApp.mock.calls[0][3].message).toBe('Hola Ana');
    expect(n.internal).toHaveBeenCalled();
    expect(prisma.automation.findMany.mock.calls[0][0].where).toMatchObject({ businessId: 'bA', active: true });
  });

  it('skips when conditions do not match', async () => {
    const { svc, n } = mk();
    expect(await svc.fire('bA', 'payment.succeeded', 'payment:1', { customerId: 'c1', payment: { amount: 50 } })).toBe(0);
    expect(n.sendWhatsApp).not.toHaveBeenCalled();
  });

  it('is idempotent per entity (unique run key)', async () => {
    const { svc, n, prisma } = mk();
    const { Prisma } = require('@prisma/client');
    prisma.automationRun.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('d', { code: 'P2002', clientVersion: 'x' }));
    expect(await svc.fire('bA', 'payment.succeeded', 'payment:1', { customerId: 'c1', payment: { amount: 250 } })).toBe(0);
    expect(n.internal).not.toHaveBeenCalled();
  });

  it('does not send promotional messages without opt-in', async () => {
    const { svc, n, prisma } = mk();
    prisma.customer.findFirst.mockResolvedValue({ id: 'c1', name: 'Ana', whatsapp: '+521555', marketingOptIn: false, tags: [] });
    await svc.fire('bA', 'payment.succeeded', 'payment:2', { customerId: 'c1', payment: { amount: 250 } });
    expect(n.sendWhatsApp).not.toHaveBeenCalled();
    expect(n.internal).toHaveBeenCalled();
  });

  it('never throws (failures are contained)', async () => {
    const { svc, prisma } = mk();
    prisma.automation.findMany.mockRejectedValue(new Error('db down'));
    await expect(svc.fire('bA', 'order.created', 'order:1', {})).resolves.toBe(0);
  });
});
