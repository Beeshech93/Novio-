import { Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export interface EmailMessage { to: string; subject: string; html: string; text: string }
export interface EmailProvider { readonly name: string; send(m: EmailMessage): Promise<void> }

export interface WhatsAppMessage { to: string; template: string; language?: string; params: string[] }
export interface WhatsAppProvider { readonly name: string; send(m: WhatsAppMessage): Promise<void> }

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';

/** Resend (https://resend.com). Enabled only when RESEND_API_KEY and EMAIL_FROM are set. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  constructor(private apiKey: string, private from: string) {}
  async send(m: EmailMessage) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}`);
  }
}

/**
 * Official WhatsApp Business Cloud API (Meta). Business-initiated messages MUST use pre-approved
 * templates; no unofficial libraries. Enabled only when WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are set.
 */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'meta';
  constructor(private token: string, private phoneId: string, private version = 'v20.0') {}

  buildPayload(m: WhatsAppMessage) {
    return {
      messaging_product: 'whatsapp',
      to: m.to.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: m.template,
        language: { code: m.language ?? 'es_MX' },
        components: m.params.length ? [{ type: 'body', parameters: m.params.map((text) => ({ type: 'text', text })) }] : [],
      },
    };
  }

  async send(m: WhatsAppMessage) {
    const res = await fetch(`https://graph.facebook.com/${this.version}/${this.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.buildPayload(m)),
    });
    if (!res.ok) throw new Error(`whatsapp ${res.status}`);
  }
}

/** Verifies Meta's X-Hub-Signature-256 over the raw body using the app secret. */
export function verifyMetaSignature(raw: Buffer, header: string | undefined, appSecret: string) {
  const given = Buffer.from((header ?? '').replace(/^sha256=/, ''), 'hex');
  const expected = createHmac('sha256', appSecret).update(raw).digest();
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException('Firma inválida');
}

/** Dev-only: logs instead of sending. Never registered in production. */
export class LogProvider implements EmailProvider, WhatsAppProvider {
  readonly name = 'log';
  private log = new Logger('Outbox');
  async send(m: EmailMessage | WhatsAppMessage) { this.log.log(`would send to ${(m as any).to}: ${(m as any).subject ?? (m as any).template}`); }
}
