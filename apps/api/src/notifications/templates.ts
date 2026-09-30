/** Transactional email templates. Every interpolated value is HTML-escaped; links must be http(s). */
export interface Rendered { subject: string; html: string; text: string }

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const safeLink = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);

function layout(title: string, lines: string[], cta?: { label: string; url?: string }): Rendered {
  const url = safeLink(cta?.url);
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f7f8fc;font-family:system-ui,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" style="max-width:100%;background:#fff;border-radius:16px;padding:32px">
<tr><td style="font-size:22px;font-weight:800;color:#5b45ff">Nuvio</td></tr>
<tr><td style="padding-top:16px;font-size:20px;font-weight:700;color:#0f1226">${esc(title)}</td></tr>
${lines.map((l) => `<tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#374151">${l}</td></tr>`).join('')}
${url && cta ? `<tr><td style="padding-top:24px"><a href="${esc(url)}" style="background:#5b45ff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${esc(cta.label)}</a></td></tr>` : ''}
<tr><td style="padding-top:28px;font-size:12px;color:#9ca3af">Haz crecer tu negocio · Nuvio</td></tr>
</table></td></tr></table></body></html>`;
  const text = [title, ...lines.map((l) => l.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')), url ? `${cta!.label}: ${url}` : ''].filter(Boolean).join('\n\n');
  return { subject: title, html, text };
}

const money = (n: number | string, cur = 'MXN') => new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur }).format(Number(n));
const when = (d: Date | string, tz = 'America/Mexico_City') =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeStyle: 'short', timeZone: tz }).format(new Date(d));

export const EMAIL_TEMPLATES = {
  welcome: (p: { name: string; url?: string }) => layout(`¡Bienvenido a Nuvio, ${p.name}!`, ['Tu negocio ya tiene su espacio. Empieza agregando tus productos o servicios y publica tu página.'], { label: 'Ir a mi panel', url: p.url }),
  verify_email: (p: { name: string; url: string }) => layout('Confirma tu correo', [`Hola ${esc(p.name)}, confirma tu correo para proteger tu cuenta.`, 'Si no creaste una cuenta, ignora este mensaje.'], { label: 'Confirmar correo', url: p.url }),
  password_reset: (p: { name: string; url: string }) => layout('Restablece tu contraseña', [`Hola ${esc(p.name)}, recibimos una solicitud para cambiar tu contraseña.`, 'El enlace caduca en 1 hora. Si no fuiste tú, ignora este mensaje.'], { label: 'Cambiar contraseña', url: p.url }),
  order_new: (p: { business: string; orderId: string; total: number | string }) => layout(`Nueva compra en ${p.business}`, [`Pedido <b>${esc(p.orderId.slice(0, 8))}</b> por <b>${esc(money(p.total))}</b>.`]),
  payment_confirmed: (p: { business: string; orderId: string; amount: number | string }) => layout('Pago confirmado', [`Recibimos tu pago de <b>${esc(money(p.amount))}</b> en ${esc(p.business)}.`, `Pedido: ${esc(p.orderId.slice(0, 8))}.`]),
  payment_failed: (p: { business: string; orderId: string; url?: string }) => layout('No pudimos procesar tu pago', [`El pago del pedido ${esc(p.orderId.slice(0, 8))} en ${esc(p.business)} no se completó.`, 'Puedes intentarlo de nuevo con otro método.'], p.url ? { label: 'Reintentar pago', url: p.url } : undefined),
  appointment_created: (p: { business: string; service: string; startAt: Date | string; tz?: string }) => layout('Tu cita fue registrada', [`<b>${esc(p.service)}</b> en ${esc(p.business)}.`, `Fecha: <b>${esc(when(p.startAt, p.tz))}</b>.`]),
  appointment_reminder: (p: { business: string; service: string; startAt: Date | string; tz?: string }) => layout('Recordatorio de tu cita', [`Te esperamos en ${esc(p.business)} para <b>${esc(p.service)}</b>.`, `Fecha: <b>${esc(when(p.startAt, p.tz))}</b>.`]),
  subscription_renewed: (p: { plan: string; until: Date | string }) => layout('Suscripción renovada', [`Tu plan <b>${esc(p.plan)}</b> está activo hasta el ${esc(when(p.until))}.`]),
  subscription_cancelled: (p: { plan: string; until?: Date | string }) => layout('Suscripción cancelada', [p.until ? `Conservas el acceso a <b>${esc(p.plan)}</b> hasta el ${esc(when(p.until))}. No borramos tus datos.` : `Tu plan <b>${esc(p.plan)}</b> fue cancelado. No borramos tus datos.`]),
} as const;

export type EmailTemplate = keyof typeof EMAIL_TEMPLATES;
export const renderEmail = <K extends EmailTemplate>(k: K, params: Parameters<(typeof EMAIL_TEMPLATES)[K]>[0]): Rendered => (EMAIL_TEMPLATES[k] as (p: any) => Rendered)(params);

/** WhatsApp (Meta Cloud API) message templates. Names must be pre-approved in Meta Business Manager. */
export const WA_TEMPLATES = {
  order_confirmation: { name: 'nuvio_order_confirmation', params: (p: { business: string; total: number | string }) => [p.business, money(p.total)] },
  appointment_confirmation: { name: 'nuvio_appointment_confirmation', params: (p: { business: string; service: string; startAt: Date | string; tz?: string }) => [p.business, p.service, when(p.startAt, p.tz)] },
  appointment_reminder: { name: 'nuvio_appointment_reminder', params: (p: { business: string; service: string; startAt: Date | string; tz?: string }) => [p.business, p.service, when(p.startAt, p.tz)] },
} as const;
