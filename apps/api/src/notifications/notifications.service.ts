import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_PROVIDER, EmailProvider, WHATSAPP_PROVIDER, WhatsAppProvider } from './providers';
import { EmailTemplate, renderEmail, WA_TEMPLATES } from './templates';

type WaKey = keyof typeof WA_TEMPLATES;

@Injectable()
export class NotificationsService {
  private log = new Logger('Notifications');
  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(EMAIL_PROVIDER) private email?: EmailProvider,
    @Optional() @Inject(WHATSAPP_PROVIDER) private whatsapp?: WhatsAppProvider,
  ) {}

  /** In-app notification for the business dashboard. */
  internal(businessId: string, type: string, title: string, body?: string) {
    return this.prisma.notification.create({ data: { businessId, channel: 'internal', type, title, body } });
  }

  /** Never throws: notification failures must not break the business action that triggered them. */
  async sendEmail<K extends EmailTemplate>(businessId: string, to: string | null | undefined, template: K, params: Parameters<typeof renderEmail<K>>[1]) {
    if (!to) return false;
    const msg = renderEmail(template, params);
    return this.deliver(businessId, 'email', template, to, template, async () => { if (!this.email) throw new Error('email provider not configured'); await this.email.send({ to, ...msg }); });
  }

  async sendWhatsApp<K extends WaKey>(businessId: string, to: string | null | undefined, key: K, params: Parameters<(typeof WA_TEMPLATES)[K]['params']>[0]) {
    if (!to) return false;
    const t = WA_TEMPLATES[key];
    return this.deliver(businessId, 'whatsapp', key, to, t.name, async () => { if (!this.whatsapp) throw new Error('whatsapp provider not configured'); await this.whatsapp.send({ to, template: t.name, params: (t.params as (p: any) => string[])(params) }); });
  }

  private async deliver(businessId: string, channel: string, type: string, recipient: string, title: string, send: () => Promise<void>) {
    let status = 'sent', error: string | undefined;
    try { await send(); } catch (e) { status = 'failed'; error = (e as Error).message; this.log.warn(`${channel}/${type} failed: ${error}`); }
    // The log row stores the recipient but never message bodies (which may contain personal data).
    await this.prisma.notification.create({ data: { businessId, channel, type, title, recipient, status, error } }).catch(() => undefined);
    return status === 'sent';
  }

  list(businessId: string) {
    return this.prisma.notification.findMany({ where: { businessId, channel: 'internal' }, orderBy: { createdAt: 'desc' }, take: 50 });
  }
  unreadCount(businessId: string) { return this.prisma.notification.count({ where: { businessId, channel: 'internal', readAt: null } }); }
  markRead(businessId: string, id: string) { return this.prisma.notification.updateMany({ where: { id, businessId }, data: { readAt: new Date() } }); }
  markAllRead(businessId: string) { return this.prisma.notification.updateMany({ where: { businessId, readAt: null, channel: 'internal' }, data: { readAt: new Date() } }); }

  /**
   * Reminders for appointments starting in the next `hoursAhead` hours. Idempotent through reminderSentAt,
   * so a scheduler can call it as often as it likes.
   */
  async sendDueReminders(hoursAhead = 24, now = new Date()) {
    const until = new Date(now.getTime() + hoursAhead * 3_600_000);
    const due = await this.prisma.appointment.findMany({
      where: { reminderSentAt: null, status: { in: ['pending', 'confirmed'] }, startAt: { gt: now, lte: until }, business: { status: 'ACTIVE', deletedAt: null } },
      include: { customer: true, service: true, business: true }, take: 200,
    });
    let sent = 0;
    for (const a of due) {
      // Claim first (guarded) so two overlapping runs can't double-send.
      const claim = await this.prisma.appointment.updateMany({ where: { id: a.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
      if (!claim.count) continue;
      const p = { business: a.business.name, service: a.service?.name ?? 'tu cita', startAt: a.startAt, tz: a.business.timezone };
      const ok = [
        await this.sendWhatsApp(a.businessId, a.customer?.whatsapp ?? a.customer?.phone, 'appointment_reminder', p),
        await this.sendEmail(a.businessId, a.customer?.email, 'appointment_reminder', p),
      ].some(Boolean);
      if (ok) sent++;
    }
    return { checked: due.length, sent };
  }
}
