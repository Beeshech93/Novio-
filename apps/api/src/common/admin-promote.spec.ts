import { ensureAdmin } from './admin-promote';

const mk = (existing: { id: string; platformRole: string } | null) => ({
  user: { findFirst: jest.fn().mockResolvedValue(existing), update: jest.fn(), create: jest.fn() },
  auditLog: { create: jest.fn() },
});

describe('ensureAdmin', () => {
  it('does nothing without ADMIN_EMAIL', async () => {
    const db = mk(null);
    expect(await ensureAdmin(db, {})).toBe('skipped');
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
  it('promotes an already-registered user, without touching their password, and audits it', async () => {
    const db = mk({ id: 'u1', platformRole: 'USER' });
    expect(await ensureAdmin(db, { ADMIN_EMAIL: ' Yo@Ejemplo.com ' })).toBe('promoted');
    expect(db.user.findFirst.mock.calls[0][0].where.email).toBe('yo@ejemplo.com');
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { platformRole: 'SUPER_ADMIN' } });
    expect(db.auditLog.create).toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it('is idempotent', async () => {
    const db = mk({ id: 'u1', platformRole: 'SUPER_ADMIN' });
    expect(await ensureAdmin(db, { ADMIN_EMAIL: 'a@b.com' })).toBe('already-admin');
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('never creates an account from the email alone', async () => {
    const db = mk(null);
    expect(await ensureAdmin(db, { ADMIN_EMAIL: 'a@b.com' })).toBe('not-registered');
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it('creates the account only with a strong ADMIN_PASSWORD (hashed)', async () => {
    const db = mk(null);
    await expect(ensureAdmin(db, { ADMIN_EMAIL: 'a@b.com', ADMIN_PASSWORD: 'corta' })).rejects.toThrow(/12/);
    expect(await ensureAdmin(db, { ADMIN_EMAIL: 'a@b.com', ADMIN_PASSWORD: 'una-clave-larga-123' })).toBe('created');
    const data = db.user.create.mock.calls[0][0].data;
    expect(data.platformRole).toBe('SUPER_ADMIN');
    expect(data.passwordHash).not.toContain('una-clave');
  });
});
