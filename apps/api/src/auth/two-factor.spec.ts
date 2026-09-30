import { ConflictException, HttpException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { AuthGuard } from '../common/auth.guard';
import { AuthService } from './auth.service';
import { base32Decode, encrypt, hotp, currentStep, newSecret } from './totp';
import { TwoFactorService } from './two-factor.service';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const codeFor = (secret: string, offset = 0) => hotp(base32Decode(secret), currentStep() + offset);

describe('two-factor authentication', () => {
  const jwt = new JwtService({ secret: 'test-secret-0123456789' });
  beforeAll(() => { process.env.TWOFA_ENCRYPTION_KEY = 'c'.repeat(64); });

  const mkUser = (over: any = {}) => {
    const secret = newSecret();
    return { secret, user: { id: 'u1', email: 'a@x.com', passwordHash: 'x', totpEnabled: true, totpSecretEnc: encrypt(secret), totpLastStep: null, recoveryCodes: [] as string[], twoFaLockedUntil: null, twoFaFailures: 0, ...over } };
  };
  const mk = (user: any) => {
    const prisma: any = {
      user: { findFirst: jest.fn().mockResolvedValue(user), findFirstOrThrow: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue({ twoFaFailures: 1 }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockReturnValue('a') }, $transaction: jest.fn().mockResolvedValue([]),
    };
    return { prisma, svc: new TwoFactorService(prisma, jwt) };
  };

  it('a 2FA challenge token is NOT accepted as a session by AuthGuard', async () => {
    const challenge = await jwt.signAsync({ sub: 'u1', purpose: '2fa' });
    const prisma: any = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', platformRole: 'USER' }) }, businessMember: { findMany: jest.fn().mockResolvedValue([{ businessId: 'b', role: 'OWNER', permissions: [] }]) } };
    const guard = new AuthGuard(jwt, prisma, { getAllAndOverride: () => undefined } as any);
    const ctx = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${challenge}` } }) }) } as any;
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    const session = await jwt.signAsync({ sub: 'u1' });
    ctx.switchToHttp = () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${session}` } }) });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('password login returns a challenge (no session) when 2FA is on', async () => {
    const { user } = mkUser({ passwordHash: await bcrypt.hash('pw-correct-1', 4) });
    const { svc } = mk(user);
    const auth = new AuthService({ user: { findFirst: jest.fn().mockResolvedValue(user) } } as any, jwt, undefined, svc);
    const r: any = await auth.login({ email: 'a@x.com', password: 'pw-correct-1' });
    expect(r.twoFactorRequired).toBe(true);
    expect(r.token).toBeUndefined();
    expect((await jwt.verifyAsync(r.challenge)).purpose).toBe('2fa');
  });

  it('completes login with a valid TOTP and records the step', async () => {
    const { user, secret } = mkUser();
    const { svc, prisma } = mk(user);
    expect(await svc.completeLogin(await svc.challenge('u1'), codeFor(secret))).toBe('u1');
    expect(prisma.user.updateMany.mock.calls[0][0].data.totpLastStep).toBe(currentStep());
  });

  it('rejects an expired or wrong-purpose challenge', async () => {
    const { user, secret } = mkUser();
    const { svc } = mk(user);
    await expect(svc.completeLogin(await jwt.signAsync({ sub: 'u1' }), codeFor(secret))).rejects.toBeInstanceOf(UnauthorizedException); // a normal session token
    await expect(svc.completeLogin('garbage.token.here'.padEnd(30, 'x'), codeFor(secret))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks replay of the same code (step already used)', async () => {
    const { user, secret } = mkUser({ totpLastStep: currentStep() });
    const { svc } = mk(user);
    await expect(svc.completeLogin(await svc.challenge('u1'), codeFor(secret))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks a parallel replay (guarded write loses the race)', async () => {
    const { user, secret } = mkUser();
    const { svc, prisma } = mk(user);
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.completeLogin(await svc.challenge('u1'), codeFor(secret))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('locks the account after too many wrong codes', async () => {
    const { user } = mkUser();
    const { svc, prisma } = mk(user);
    prisma.user.update.mockResolvedValue({ twoFaFailures: 5 });
    await expect(svc.completeLogin(await svc.challenge('u1'), '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    const lock = prisma.user.update.mock.calls.find((c: any) => c[0].data.twoFaLockedUntil);
    expect(lock[0].data.twoFaLockedUntil.getTime()).toBeGreaterThan(Date.now());
    const locked = mk({ ...user, twoFaLockedUntil: new Date(Date.now() + 60_000) });
    await expect(locked.svc.completeLogin(await locked.svc.challenge('u1'), codeFor(mkUser().secret))).rejects.toBeInstanceOf(HttpException);
  });

  it('recovery codes work once', async () => {
    const { user } = mkUser({ recoveryCodes: [sha('abcd-1234'), sha('ffff-0000')] });
    const { svc, prisma } = mk(user);
    expect(await svc.completeLogin(await svc.challenge('u1'), 'ABCD-1234')).toBe('u1'); // case/space tolerant
    const data = prisma.user.updateMany.mock.calls[0][0].data;
    expect(data.recoveryCodes).toEqual([sha('ffff-0000')]); // used one removed
    prisma.user.updateMany.mockResolvedValue({ count: 0 }); // second attempt: already consumed
    await expect(svc.completeLogin(await svc.challenge('u1'), 'abcd-1234')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('enable stores only hashed recovery codes and the encrypted secret is never returned', async () => {
    const { secret, user } = mkUser({ totpEnabled: false });
    const { svc, prisma } = mk(user);
    const r = await svc.enable('u1', codeFor(secret));
    expect(r.recoveryCodes).toHaveLength(10);
    const stored = prisma.user.update.mock.calls[0][0].data.recoveryCodes;
    expect(stored).toEqual(r.recoveryCodes.map(sha));
    expect(JSON.stringify(stored)).not.toContain(r.recoveryCodes[0]);
    await expect(svc.enable('u1', '000000')).rejects.toBeTruthy();
  });

  it('setup refuses when already enabled, and when the server has no encryption key', async () => {
    const { user } = mkUser();
    await expect(mk(user).svc.setup('u1')).rejects.toBeInstanceOf(ConflictException);
    const saved = process.env.TWOFA_ENCRYPTION_KEY; delete process.env.TWOFA_ENCRYPTION_KEY;
    await expect(mk(user).svc.setup('u1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    process.env.TWOFA_ENCRYPTION_KEY = saved;
  });

  it('setup returns a QR and a secret but persists it encrypted', async () => {
    const { user } = mkUser({ totpEnabled: false });
    const { svc, prisma } = mk(user);
    const r = await svc.setup('u1');
    expect(r.qr).toMatch(/^data:image\/png;base64,/);
    expect(r.otpauthUri).toContain(`secret=${r.secret}`);
    expect(prisma.user.update.mock.calls[0][0].data.totpSecretEnc).not.toContain(r.secret);
  });

  it('disable needs the password AND a valid code', async () => {
    const { user, secret } = mkUser({ passwordHash: await bcrypt.hash('pw-correct-1', 4) });
    const { svc } = mk(user);
    await expect(svc.disable('u1', 'wrong-password', codeFor(secret))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.disable('u1', 'pw-correct-1', codeFor(secret))).resolves.toBeUndefined();
  });
});
