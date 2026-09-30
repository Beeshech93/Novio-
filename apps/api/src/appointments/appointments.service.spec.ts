import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AppointmentsService, canMove } from './appointments.service';

describe('AppointmentsService', () => {
  beforeAll(() => { jest.useFakeTimers({ now: new Date('2026-06-01T00:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'] }); });
  afterAll(() => jest.useRealTimers());
  // Monday 2026-06-15, open 9:00-11:00 Mexico City (UTC-6) => 15:00-17:00Z
  const mk = () => {
    const tx: any = {
      businessHours: { findUnique: jest.fn().mockResolvedValue({ openMin: 540, closeMin: 660 }) },
      blockedDate: { findFirst: jest.fn().mockResolvedValue(null) },
      appointment: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockImplementation(async (a: any) => a.data) },
    };
    const prisma: any = {
      ...tx,
      service: { findFirst: jest.fn().mockResolvedValue({ id: 's1', durationMin: 60 }), updateMany: jest.fn() },
      business: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'bA', timezone: 'America/Mexico_City' }) },
      employee: { findFirst: jest.fn() },
      customer: { findFirst: jest.fn() },
      website: { findFirst: jest.fn() },
      $transaction: (fn: any) => fn(tx),
    };
    return { prisma, tx, svc: new AppointmentsService(prisma) };
  };
  const start = '2026-06-15T15:30:00.000Z';

  it('books an open slot inside the transaction', async () => {
    const { svc, tx } = mk();
    const a: any = await svc.create('bA', { serviceId: 's1', startAt: start });
    expect(a).toMatchObject({ businessId: 'bA', serviceId: 's1' });
    expect(a.endAt.toISOString()).toBe('2026-06-15T16:30:00.000Z');
    expect(tx.appointment.create).toHaveBeenCalled();
  });

  it('rejects a slot outside opening hours', async () => {
    const { svc } = mk();
    await expect(svc.create('bA', { serviceId: 's1', startAt: '2026-06-15T18:00:00.000Z' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a slot that overlaps an existing appointment', async () => {
    const { svc, tx } = mk();
    tx.appointment.findMany.mockResolvedValue([{ startAt: new Date('2026-06-15T15:00:00Z'), endAt: new Date('2026-06-15T16:00:00Z') }]);
    await expect(svc.create('bA', { serviceId: 's1', startAt: start })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it('rejects a service or employee from another business', async () => {
    const { svc, prisma } = mk();
    prisma.service.findFirst.mockResolvedValue(null);
    await expect(svc.create('bA', { serviceId: 'x', startAt: start })).rejects.toBeInstanceOf(BadRequestException);
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(svc.create('bA', { serviceId: 's1', startAt: start, employeeId: 'emp-of-B' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.employee.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'emp-of-B', businessId: 'bA' });
  });

  it('public booking only works on published sites', async () => {
    const { svc, prisma } = mk();
    prisma.website.findFirst.mockResolvedValue(null);
    await expect(svc.publicBook('nope', { serviceId: 's1', startAt: start, name: 'Ana', phone: '5512345678' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.website.findFirst.mock.calls[0][0].where).toMatchObject({ published: true });
  });

  it('status machine', () => {
    expect(canMove('pending', 'confirmed')).toBe(true);
    expect(canMove('pending', 'completed')).toBe(false);
    expect(canMove('confirmed', 'no_show')).toBe(true);
    expect(canMove('cancelled', 'confirmed')).toBe(false);
  });

  it('hours: rejects close <= open', async () => {
    const { svc } = mk();
    await expect(svc.setHours('bA', [{ weekday: 1, openMin: 600, closeMin: 600 }])).rejects.toBeInstanceOf(BadRequestException);
  });
});
