import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthGuard } from '../common/auth.guard';
import { AuthService, hashToken } from './auth.service';

describe('account flows', () => {
  const mk = () => {
    const prisma: any = {
      user: { findFirst: jest.fn(), update: jest.fn().mockReturnValue('u'), findFirstOrThrow: jest.fn() },
      authToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), create: jest.fn().mockReturnValue('c'), findUniqueOrThrow: jest.fn().mockResolvedValue({ userId: 'u1' }) },
      auditLog: { create: jest.fn().mockReturnValue('a') },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const notifications: any = { sendEmail: jest.fn().mockResolvedValue(true) };
    return { prisma, notifications, svc: new AuthService(prisma, {} as any, notifications) };
  };

  it('forgot-password stores only a hash and emails a link with the raw token', async () => {
    const { svc, prisma, notifications } = mk();
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', name: 'Ana', email: 'a@x.com', memberships: [{ businessId: 'b1' }] });
    await svc.forgotPassword('A@x.com');
    const url: string = notifications.sendEmail.mock.calls[0][3].url;
    const raw = new URL(url).searchParams.get('token')!;
    expect(raw.length).toBeGreaterThan(30);
    const created = prisma.authToken.create.mock.calls[0][0].data;
    expect(created.tokenHash).toBe(hashToken(raw));
    expect(JSON.stringify(created)).not.toContain(raw);
    expect(created.kind).toBe('password_reset');
    expect(created.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3_600_000);
  });

  it('forgot-password does not reveal unknown emails (silent, no email, no token)', async () => {
    const { svc, prisma, notifications } = mk();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(svc.forgotPassword('nobody@x.com')).resolves.toBeUndefined();
    expect(notifications.sendEmail).not.toHaveBeenCalled();
    expect(prisma.authToken.create).not.toHaveBeenCalled();
  });

  it('reset-password rejects invalid/expired/used tokens (atomic claim fails)', async () => {
    const { svc, prisma } = mk();
    prisma.authToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.resetPassword('x'.repeat(40), 'newpassword1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    const where = prisma.authToken.updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ kind: 'password_reset', usedAt: null });
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it('reset-password hashes the new password and revokes earlier sessions', async () => {
    const { svc, prisma } = mk();
    await svc.resetPassword('x'.repeat(40), 'newpassword1');
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(await bcrypt.compare('newpassword1', data.passwordHash)).toBe(true);
    expect(data.passwordChangedAt).toBeInstanceOf(Date);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('verify-email marks the user verified only for a valid token', async () => {
    const { svc, prisma } = mk();
    await svc.verifyEmail('y'.repeat(40));
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { emailVerified: true } });
    prisma.authToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.user.update.mockClear();
    await expect(svc.verifyEmail('z'.repeat(40))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('a JWT issued before the password change is rejected', async () => {
    const changed = new Date('2026-06-15T12:00:00Z');
    const prisma: any = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', platformRole: 'USER', passwordChangedAt: changed }) }, businessMember: { findMany: jest.fn().mockResolvedValue([{ businessId: 'b', role: 'OWNER', permissions: [] }]) } };
    const guard = (iat: number) => new AuthGuard({ verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1', iat }) } as any, prisma, { getAllAndOverride: () => undefined } as any);
    const ctx = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer t' } }) }) } as any;
    await expect(guard(Math.floor(changed.getTime() / 1000) - 3600).canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard(Math.floor(changed.getTime() / 1000) + 60).canActivate(ctx)).resolves.toBe(true);
  });
});
