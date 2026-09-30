'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Campaign { id: string; name: string; channel: 'whatsapp' | 'email'; status: string; sentCount: number; failedCount: number }
interface Automation { id: string; name: string; active: boolean; triggers: { type: string }[]; actions: { type: string }[] }

const TRIGGERS: [string, string][] = [['payment.succeeded', 'Se confirma un pago'], ['order.created', 'Se crea un pedido'], ['appointment.created', 'Se crea una cita'], ['customer.inactive', 'Un cliente lleva tiempo sin comprar']];
const ACTIONS: [string, string][] = [['internal_notification', 'Avisarme en el panel'], ['send_whatsapp', 'Enviar WhatsApp al cliente'], ['send_email', 'Enviar correo al cliente'], ['tag_customer', 'Etiquetar al cliente']];
const label = (list: [string, string][], v: string) => list.find(([k]) => k === v)?.[1] ?? v;

const DEMO_C: Campaign[] = [{ id: 'c1', name: 'Recupera clientes', channel: 'whatsapp', status: 'sent', sentCount: 18, failedCount: 1 }];
const DEMO_A: Automation[] = [{ id: 'a1', name: 'Agradecer compras grandes', active: true, triggers: [{ type: 'payment.succeeded' }], actions: [{ type: 'send_whatsapp' }] }];

export function MarketingExtras() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [autos, setAutos] = useState<Automation[]>([]);
  const [demo, setDemo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reach, setReach] = useState<{ total: number; reachable: number } | null>(null);
  const [trigger, setTrigger] = useState('payment.succeeded');

  const load = useCallback(() => {
    Promise.all([api<Campaign[]>('/campaigns'), api<Automation[]>('/automations')])
      .then(([c, a]) => { setCampaigns(c); setAutos(a); setDemo(false); })
      .catch(() => { setDemo(true); setCampaigns(DEMO_C); setAutos(DEMO_A); });
  }, []);
  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>, demoFn: () => void, ok = '') {
    setMsg(null);
    if (demo) { demoFn(); return; }
    try { await fn(); if (ok) setMsg({ ok: true, text: ok }); load(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  const segmentOf = (f: FormData) => ({ inactiveDays: f.get('inactive') ? Number(f.get('inactive')) : undefined, tag: (f.get('tag') as string) || undefined });

  async function preview(form: HTMLFormElement | null) {
    if (!form) return;
    if (demo) return setReach({ total: 42, reachable: 27 });
    try { setReach(await api('/segments/preview', { method: 'POST', body: JSON.stringify(segmentOf(new FormData(form))) })); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  function createCampaign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
    const body = { name: String(f.get('name')), channel: f.get('channel') as 'whatsapp' | 'email', message: String(f.get('message')), subject: (f.get('name') as string), segment: segmentOf(f) };
    run(() => api('/campaigns', { method: 'POST', body: JSON.stringify(body) }), () => setCampaigns((c) => [{ id: String(Date.now()), name: body.name, channel: body.channel, status: 'draft', sentCount: 0, failedCount: 0 }, ...c]), 'Campaña creada como borrador').then(() => form.reset());
  }
  function createAuto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
    const min = f.get('minAmount');
    const body = {
      name: String(f.get('name')), trigger, inactiveDays: trigger === 'customer.inactive' ? Number(f.get('days') || 60) : undefined,
      conditions: trigger === 'payment.succeeded' && min ? [{ field: 'payment.amount', op: 'gte', value: Number(min) }] : [],
      actions: [{ type: String(f.get('action')), message: String(f.get('message') || ''), title: 'Automatización', tag: (f.get('tagName') as string) || undefined }],
    };
    run(() => api('/automations', { method: 'POST', body: JSON.stringify(body) }), () => setAutos((a) => [{ id: String(Date.now()), name: body.name, active: true, triggers: [{ type: trigger }], actions: [{ type: body.actions[0].type }] }, ...a]), 'Automatización creada').then(() => form.reset());
  }

  return (
    <>
      {demo && <p className="mt-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Campañas y automatizaciones en modo demostración: sin API conectada.</p>}
      {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      <h2 className="mt-8 text-lg font-bold">Campañas</h2>
      <p className="text-sm text-slate-600">Solo se envían a clientes que aceptaron recibir promociones.</p>
      <form onSubmit={createCampaign} className="card mt-2 grid gap-3 sm:grid-cols-4">
        <input name="name" required placeholder="Nombre de la campaña" className="input sm:col-span-2" />
        <select name="channel" className="input"><option value="whatsapp">WhatsApp</option><option value="email">Correo</option></select>
        <input name="inactive" type="number" min={1} placeholder="Sin comprar (días)" className="input" />
        <input name="tag" placeholder="Etiqueta (opcional)" className="input" />
        <textarea name="message" required maxLength={900} rows={3} placeholder="Hola {{customer.name}}, esta semana tenemos…" className="input sm:col-span-4" />
        <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
          <button className="btn btn-primary">Crear borrador</button>
          <button type="button" className="btn" onClick={(e) => preview((e.currentTarget.form))}>Ver a cuántos llega</button>
          {reach && <span className="text-sm text-slate-600">{reach.reachable} de {reach.total} clientes aceptaron promociones</span>}
        </div>
      </form>
      <div className="mt-3 space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-2 !p-4 text-sm">
            <span><b>{c.name}</b> · {c.channel === 'whatsapp' ? 'WhatsApp' : 'Correo'}</span>
            <span className="flex items-center gap-3">
              {c.status === 'sent' ? <span className="text-emerald-700">Enviada: {c.sentCount} ok{c.failedCount ? `, ${c.failedCount} fallidos` : ''}</span> : <span className="text-slate-500">Borrador</span>}
              {c.status === 'draft' && <button className="btn !px-3 !py-1 text-xs" onClick={() => { if (confirm('¿Enviar la campaña ahora? No se puede deshacer.')) run(() => api(`/campaigns/${c.id}/send`, { method: 'POST' }), () => setCampaigns((x) => x.map((y) => (y.id === c.id ? { ...y, status: 'sent', sentCount: 27 } : y))), 'Campaña enviada'); }}>Enviar</button>}
            </span>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-sm text-slate-500">Aún no hay campañas.</p>}
      </div>

      <h2 className="mt-8 text-lg font-bold">Automatizaciones</h2>
      <p className="text-sm text-slate-600">Cuando <b>pase algo</b> → si se cumple una condición → <b>haz algo</b>.</p>
      <form onSubmit={createAuto} className="card mt-2 grid gap-3 sm:grid-cols-4">
        <input name="name" required placeholder="Nombre" className="input sm:col-span-4" />
        <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="input sm:col-span-2">{TRIGGERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {trigger === 'payment.succeeded' && <input name="minAmount" type="number" min={0} placeholder="Monto mínimo (opcional)" className="input sm:col-span-2" />}
        {trigger === 'customer.inactive' && <input name="days" type="number" min={1} defaultValue={60} placeholder="Días sin comprar" className="input sm:col-span-2" />}
        <select name="action" className="input sm:col-span-2">{ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input name="tagName" placeholder="Etiqueta (si etiquetas)" className="input sm:col-span-2" />
        <textarea name="message" maxLength={900} rows={2} placeholder="Mensaje: Gracias {{customer.name}} por tu compra en {{business.name}}" className="input sm:col-span-4" />
        <button className="btn btn-primary sm:col-span-4">Crear automatización</button>
      </form>
      <div className="mt-3 space-y-2">
        {autos.map((a) => (
          <div key={a.id} className="card flex flex-wrap items-center justify-between gap-2 !p-4 text-sm">
            <span><b>{a.name}</b><br /><span className="text-slate-500">{label(TRIGGERS, a.triggers[0]?.type)} → {label(ACTIONS, a.actions[0]?.type)}</span></span>
            <span className="flex items-center gap-2">
              <button className="btn !px-3 !py-1 text-xs" onClick={() => run(() => api(`/automations/${a.id}/active`, { method: 'PUT', body: JSON.stringify({ active: !a.active }) }), () => setAutos((x) => x.map((y) => (y.id === a.id ? { ...y, active: !y.active } : y))))}>{a.active ? 'Pausar' : 'Activar'}</button>
              <button className="text-xs text-red-600" onClick={() => run(() => api(`/automations/${a.id}`, { method: 'DELETE' }), () => setAutos((x) => x.filter((y) => y.id !== a.id)))}>Eliminar</button>
            </span>
          </div>
        ))}
        {autos.length === 0 && <p className="text-sm text-slate-500">Aún no hay automatizaciones.</p>}
      </div>
    </>
  );
}
