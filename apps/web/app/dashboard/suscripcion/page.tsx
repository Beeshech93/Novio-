'use client';
import { useEffect, useMemo, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

interface Plan { id: string; name: string; slug: string; billingInterval: 'MONTHLY' | 'YEARLY'; price: string | number; currency: string; features: string[] }
interface Sub { status: string; billingInterval: 'MONTHLY' | 'YEARLY'; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; plan: Plan }

const FEATURE_LABEL: Record<string, string> = { website: 'Página web', products: 'Productos', customers: 'Clientes', orders: 'Pedidos', appointments: 'Citas', whatsapp: 'WhatsApp', invoices: 'Facturación', analytics: 'Analytics', automation: 'Automatizaciones', marketing: 'Marketing', inventory: 'Inventario', ecommerce: 'Tienda en línea', advanced_reports: 'Reportes avanzados' };
const STATUS: Record<string, string> = { trialing: 'En prueba', active: 'Activa', past_due: 'Pago vencido', paused: 'Pausada', cancelled: 'Cancelada', expired: 'Expirada' };
const money = (n: string | number, cur = 'MXN') => new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(n));

const mkPlan = (name: string, slug: string, m: number, y: number, features: string[]): Plan[] => [
  { id: `${slug}-m`, name, slug, billingInterval: 'MONTHLY', price: m, currency: 'MXN', features }, { id: `${slug}-y`, name, slug, billingInterval: 'YEARLY', price: y, currency: 'MXN', features },
];
const DEMO_PLANS = [...mkPlan('Nuvio Básico', 'basico', 199, 1990, ['website', 'products', 'customers', 'orders']), ...mkPlan('Nuvio Profesional', 'profesional', 399, 3990, ['website', 'products', 'customers', 'orders', 'appointments', 'whatsapp', 'inventory', 'ecommerce', 'analytics']), ...mkPlan('Nuvio Negocio', 'negocio', 799, 7990, ['website', 'products', 'customers', 'orders', 'appointments', 'whatsapp', 'inventory', 'ecommerce', 'analytics', 'invoices', 'marketing', 'automation', 'advanced_reports'])];

export default function Suscripcion() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);
  const [interval, setInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [demo, setDemo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');

  const load = () => {
    Promise.all([api<Plan[]>('/plans'), api<{ subscription: Sub | null }>('/subscriptions')])
      .then(([p, s]) => { setPlans(p); setSub(s.subscription); setDemo(false); })
      .catch(() => { setDemo(true); setPlans(DEMO_PLANS); setSub({ status: 'trialing', billingInterval: 'MONTHLY', currentPeriodEnd: new Date(Date.now() + 9 * 86_400_000).toISOString(), cancelAtPeriodEnd: false, plan: DEMO_PLANS[0] }); });
  };
  useEffect(load, []);

  const grouped = useMemo(() => {
    const m = new Map<string, Plan[]>();
    plans.forEach((p) => m.set(p.slug, [...(m.get(p.slug) ?? []), p]));
    return [...m.values()].map((ps) => ({ name: ps[0].name, slug: ps[0].slug, price: ps.find((p) => p.billingInterval === interval), features: ps[0].features }));
  }, [plans, interval]);

  async function choose(slug: string) {
    setMsg(null); setBusy(slug);
    if (demo) { setMsg({ ok: false, text: 'Modo demostración: el cobro necesita la API y un proveedor de pagos conectados.' }); setBusy(''); return; }
    try {
      const r = await api<{ checkoutUrl: string }>('/subscriptions/checkout', { method: 'POST', body: JSON.stringify({ planSlug: slug, interval }) });
      window.location.href = r.checkoutUrl;
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); setBusy(''); }
  }
  async function cancel(cancelIt: boolean) {
    if (demo) return setSub((s) => s && { ...s, cancelAtPeriodEnd: cancelIt });
    try { await api('/subscriptions/cancel', { method: 'POST', body: JSON.stringify({ cancel: cancelIt }) }); load(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Suscripción</h1>
      {demo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Modo demostración: datos de ejemplo, sin API conectada.</p>}
      {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      {sub && (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Tu plan actual</p>
            <p className="text-xl font-extrabold">{sub.plan.name} <span className="ml-2 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">{STATUS[sub.status] ?? sub.status}</span></p>
            {sub.currentPeriodEnd && <p className="text-sm text-slate-600">{sub.cancelAtPeriodEnd ? 'Se cancela el' : sub.status === 'trialing' ? 'La prueba termina el' : 'Se renueva el'} {new Date(sub.currentPeriodEnd).toLocaleDateString('es-MX', { dateStyle: 'long' })}. Tus datos no se borran.</p>}
          </div>
          {['active', 'trialing', 'past_due'].includes(sub.status) && (
            <button onClick={() => cancel(!sub.cancelAtPeriodEnd)} className="btn text-sm">{sub.cancelAtPeriodEnd ? 'Reactivar renovación' : 'Cancelar al final del periodo'}</button>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        {(['MONTHLY', 'YEARLY'] as const).map((i) => (
          <button key={i} onClick={() => setInterval(i)} className={`btn !px-4 !py-2 text-sm ${interval === i ? '!bg-brand !text-white' : ''}`}>{i === 'MONTHLY' ? 'Mensual' : 'Anual'}</button>
        ))}
        <span className="text-xs text-slate-500">El plan anual ahorra ~2 meses</span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {grouped.map((g) => {
          const current = sub?.plan.slug === g.slug;
          return (
            <div key={g.slug} className={`card ${current ? 'ring-2 ring-brand' : ''}`}>
              <h2 className="text-lg font-bold">{g.name}</h2>
              <p className="mt-2 text-3xl font-extrabold">{g.price ? money(g.price.price, g.price.currency) : '—'}<span className="text-sm font-medium text-slate-500"> /{interval === 'MONTHLY' ? 'mes' : 'año'}</span></p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">{g.features.map((f) => <li key={f}>✓ {FEATURE_LABEL[f] ?? f}</li>)}</ul>
              <button disabled={current || busy === g.slug} onClick={() => choose(g.slug)} className="btn btn-primary mt-4 w-full disabled:opacity-50">{current ? 'Plan actual' : busy === g.slug ? 'Un momento…' : 'Elegir plan'}</button>
            </div>
          );
        })}
      </div>
    </DashShell>
  );
}
