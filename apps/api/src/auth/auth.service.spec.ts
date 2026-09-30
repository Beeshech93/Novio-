import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: 'u1', name: 'Ana', email: 'a@x.com', phone: null, platformRole: 'USER' }) },
    business: { create: jest.fn().mockResolvedValue({ id: 'b1', slug: 'mi-barberia' }) },
    businessMember: { create: jest.fn() },
    website: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    plan: { findFirst: jest.fn().mockResolvedValue({ id: 'plan1' }) },
    subscription: { create: jest.fn() },
  };
  const prisma: any = {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    business: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: (fn: any) => fn(tx),
  };
  const jwt: any = { signAsync: jest.fn().mockResolvedValue('tok') };
  const svc = new AuthService(prisma, jwt);
  const dto: any = { name: 'Ana', email: 'A@x.com', password: 'secret123', business: { name: 'Mi Barbería', category: 'barberia' } };

  it('creates user, business and OWNER membership; hashes password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await svc.register(dto);
    expect(res.token).toBe('tok');
    expect(tx.businessMember.create).toHaveBeenCalledWith({ data: { businessId: 'b1', userId: 'u1', role: 'OWNER' } });
    const hash = tx.user.create.mock.calls[0][0].data.passwordHash;
    expect(hash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', hash)).toBe(true);
    expect(tx.user.create.mock.calls[0][0].data.email).toBe('a@x.com');
    expect(tx.subscription.create.mock.calls[0][0].data).toMatchObject({ businessId: 'b1', status: 'trialing', provider: 'trial' });
  });

  it('rejects duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });
    await expect(svc.register(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects wrong password and unknown user', async () => {
    const passwordHash = await bcrypt.hash('right-pass', 4);
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'u1', passwordHash });
    await expect(svc.login({ email: 'a@x.com', password: 'wrong' })).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(svc.login({ email: 'n@x.com', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
