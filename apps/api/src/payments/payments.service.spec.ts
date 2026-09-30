import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MockPaymentProvider } from './mock.provider';
import { PaymentsService } from './payments.service';

const provider = new MockPaymentProvider('s3cret');
const body = (over: any = {}) => Buffer.from(JSON.stringify({ id: 'evt_1', type: 'payment.succeeded', data: { paymentId: 'pp_1', amountCents: 10000, currency: 'MXN' }, ...over }));

describe('PaymentsService webhooks', () => {
  const tx: any = {
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'pay1', orderId: 'o1', businessId: 'b1' }), },
    order: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'o1', status: 'NEW', total: 100, customerId: 'c1', payments: [{ status: 'SUCCEEDED', amount: 100 }] }), update: jest.fn() },
    customer: { update: jest.fn() },
  };
  const prisma: any = {
    webhookEvent: { create: jest.fn(), updateMany: jest.fn() },
    payment: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: (fn: any) => fn(tx),
  };
  const svc = new PaymentsService(prisma, new Map([['mock', provider]]));
  beforeEach(() => { jest.clearAllMocks(); prisma.webhookEvent.create.mockResolvedValue({}); prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', businessId: 'b1', amount: 100, currency: 'MXN', status: 'PENDING' }); });

  it('rejects a bad signature and touches nothing', async () => {
    await expect(svc.handleWebhook('mock', body(), 'deadbeef')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.handleWebhook('mock', body(), undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a body altered after signing', async () => {
    const good = body(); const sig = provider.sign(good);
    await expect(svc.handleWebhook('mock', body({ data: { paymentId: 'pp_1', amountCents: 1, currency: 'MXN' } }), sig)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('marks paid, confirms order and updates customer on a valid event', async () => {
    const b = body();
    await svc.handleWebhook('mock', b, provider.sign(b));
    expect(tx.payment.updateMany.mock.calls[0][0].where).toMatchObject({ id: 'pay1', businessId: 'b1', status: 'PENDING' });
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'CONFIRMED' } });
    expect(tx.customer.update).toHaveBeenCalled();
  });

  it('is idempotent on a repeated event id', async () => {
    prisma.webhookEvent.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    const b = body();
    expect(await svc.handleWebhook('mock', b, provider.sign(b))).toEqual({ received: true, duplicate: true });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('does not mark paid when the amount mismatches', async () => {
    const b = body({ data: { paymentId: 'pp_1', amountCents: 5000, currency: 'MXN' } });
    await svc.handleWebhook('mock', b, provider.sign(b));
    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay1' }, data: { status: 'FAILED' } });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('online payments cannot be confirmed manually', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', method: 'CARD' });
    await expect(svc.confirmManual('b1', 'pay1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PaymentsService.create', () => {
  const prisma: any = { order: { findFirst: jest.fn() }, payment: { create: jest.fn(), update: jest.fn() } };
  const svc = new PaymentsService(prisma, new Map());
  it('refuses to pay an already-paid order', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'o1', status: 'CONFIRMED', total: 100, payments: [{ status: 'SUCCEEDED', amount: 100, method: 'CARD' }] });
    await expect(svc.create('b1', 'o1', 'CARD')).rejects.toBeInstanceOf(ConflictException);
  });
});
