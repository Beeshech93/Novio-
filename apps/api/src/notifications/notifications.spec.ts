import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { NotificationsService } from './notifications.service';
import { MetaWhatsAppProvider, verifyMetaSignature } from './providers';
import { EMAIL_TEMPLATES, renderEmail, WA_TEMPLATES } from './templates';

describe('email templates', () => {
  it('has all 10 required templates', () => {
    expect(Object.keys(EMAIL_TEMPLATES).sort()).toEqual([
      'appointment_created', 'appointment_reminder', 'order_new', 'password_reset', 'payment_confirmed', 'payment_failed',
      'subscription_cancelled', 'subscription_renewed', 'verify_email', 'welcome',
    ]);
  });
  it('escapes HTML in user-controlled values', () => {
    const r = renderEmail('appointment_created', { business: '<script>alert(1)</script>', service: 'Corte "x"', startAt: new Date('2026-06-15T16:00:00Z') });
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).toContain('&quot;x&quot;');
  });
  it('drops non-http(s) links', () => {
    expect(renderEmail('welcome', { name: 'Ana', url: 'javascript:alert(1)' }).html).not.toContain('javascript:');
    expect(renderEmail('welcome', { name: 'Ana', url: 'https://app.nuvio.app' }).html).toContain('href="https://app.nuvio.app"');
  });
  it('formats dates in the business timezone', () => {
    const r = renderEmail('appointment_reminder', { business: 'B', service: 'S', startAt: new Date('2026-06-15T16:00:00Z'), tz: 'America/Mexico_City' });
    expect(r.text).toMatch(/10:00/);
  });
});

describe('WhatsApp (Meta) provider', () => {
  it('builds an official template payload', () => {
    const p = new MetaWhatsAppProvider('t', 'pid').buildPayload({ to: '+52 1 55 1234 5678', template: 'nuvio_appointment_reminder', params: ['Barbería', 'Corte', 'lunes'] });
    expect(p).toMatchObject({ messaging_product: 'whatsapp', to: '5215512345678', type: 'template', template: { name: 'nuvio_appointment_reminder', language: { code: 'es_MX' } } });
    expect(p.template.components[0].parameters).toHaveLength(3);
  });
  it('verifies X-Hub-Signature-256', () => {
    const raw = Buffer.from('{"a":1}');
    const sig = 'sha256=' + createHmac('sha256', 'app-secret').update(raw).digest('hex');
    expect(() => verifyMetaSignature(raw, sig, 'app-secret')).not.toThrow();
    expect(() => verifyMetaSignature(raw, sig, 'other')).toThrow(UnauthorizedException);
    expect(() => verifyMetaSignature(raw, undefined, 'app-secret')).toThrow(UnauthorizedException);
  });
  it('template params come from the wa template table', () => {
    expect(WA_TEMPLATES.order_confirmation.params({ business: 'X', total: 100 })[0]).toBe('X');
  });
});

describe('NotificationsService', () => {
  const prisma: any = {
    notification: { create: jest.fn().mockResolvedValue({}) },
    appointment: { findMany: jest.fn(), updateMany: jest.fn() },
  };
  beforeEach(() => jest.clearAllMocks());

  it('never throws when a provider fails, and records the failure', async () => {
    const svc = new NotificationsService(prisma, { name: 'x', send: jest.fn().mockRejectedValue(new Error('boom')) } as any);
    await expect(svc.sendEmail('b1', 'a@x.com', 'welcome', { name: 'Ana' })).resolves.toBe(false);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ channel: 'email', status: 'failed', recipient: 'a@x.com', businessId: 'b1' });
    expect(JSON.stringify(prisma.notification.create.mock.calls[0][0].data)).not.toContain('Ana'); // no message body stored
  });

  it('skips silently without a recipient; reports failure without a configured provider', async () => {
    const svc = new NotificationsService(prisma);
    expect(await svc.sendEmail('b1', null, 'welcome', { name: 'A' })).toBe(false);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(await svc.sendEmail('b1', 'a@x.com', 'welcome', { name: 'A' })).toBe(false);
    expect(prisma.notification.create.mock.calls[0][0].data.status).toBe('failed');
  });

  it('reminders are claimed once (idempotent)', async () => {
    const wa = { name: 'w', send: jest.fn() };
    const svc = new NotificationsService(prisma, undefined, wa as any);
    const appt = { id: 'a1', businessId: 'b1', startAt: new Date('2026-06-15T16:00:00Z'), customer: { whatsapp: '+5215512345678', email: null }, service: { name: 'Corte' }, business: { name: 'B', timezone: 'America/Mexico_City' } };
    prisma.appointment.findMany.mockResolvedValue([appt]);
    prisma.appointment.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await svc.sendDueReminders(24, new Date('2026-06-15T00:00:00Z'))).toEqual({ checked: 1, sent: 1 });
    expect(await svc.sendDueReminders(24, new Date('2026-06-15T00:00:00Z'))).toEqual({ checked: 1, sent: 0 });
    expect(wa.send).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.findMany.mock.calls[0][0].where).toMatchObject({ reminderSentAt: null });
  });
});
