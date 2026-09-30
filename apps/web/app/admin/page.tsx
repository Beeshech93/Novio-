'use client';
import { useCallback, useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

interface Metrics { mrr: number; arr: number; arpu: number; churn30d: number; conversion: number; activeSubscriptions: number; trialing: number; newBusinesses30d: number; totalBusinesses: number; cancelledSubscriptions: number }
interface Biz { id: string; name: string; category: string; status: 'ACTIVE' | 'SUSPENDED'; createdAt: string; subscriptions: { status: string; plan: { name: string } }[]; members: { user: { name: string; email: string } }[] }
interface Plan { id: string; name: string; slug: string; billingInterval: 'MONTHLY' | 'YEARLY'; price: string | number; active: boolean }

const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const DEMO_M: Metrics = { mrr: 18450, arr: 221400, arpu: 461, churn30d: 0.032, conversion: 0.41, activeSubscriptions: 40, trialing: 17, newBusinesses30d: 23, totalBusinesses: 98, cancelledSubscriptions: 6 };
const DEMO_B: Biz[] = [
  { id: 'b1', name: 'Barbería Luis', category: 'barbería', status: 'ACTIVE', createdAt: new Date().toISOString(), subscriptions: [{ status: 'active', plan: { name: 'Nuvio Profesional' } }], members: [{ user: { name: 'Luis Gómez', email: 'luis@ejemplo.com' } }] },
  { id: 'b2', name: 'Tacos El Güero', category: 'restaurante', status: 'ACTIVE', createdAt: new Date().toISOString(), subscriptions: [{ status: 'trialing', plan: { name: 'Nuvio Básico' } }], members: [{ user: { name: 'Ana Ríos', email: 'ana@ejemplo.com' } }] },
];
const DEMO_P: Plan[] = [
  { id: 'p1', name: 'Nuvio Básico', slug: 'basico', billingInterval: 'MONTHLY', price: 199, active: true }, { id: 'p2', name: 'Nuvio Básico', slug: 'basico', billingInterval: 'YEARLY', price: 1990, active: true },
  { id: 'p3', name: 'Nuvio Profesional', slug: 'profesional', billingInterval: 'MONTHLY', price: 399, active: true }, { id: 'p4', name: 'Nuvio Negocio', slug: 'negocio', billingInterval: 'MONTHLY', price: 799, active: true },
];

export default function Admin() {
  const [m, setM] = useState<Metrics>(); const [biz, setBiz] = useState<Biz[]>([]); const [plans, setPlans] = useState<Plan[]>([]);
  const [demo, setDemo] = useState(false); const [denied, setDenied] = useState(false); const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    Promise.all([api<Metrics>('/admin/metrics'), api<{ items: Biz[] }>('/admin/businesses'), api<Plan[]>('/admin/plans')])
      .then(([a, b, c]) => { setM(a); setBiz(b.items); setPlans(c); setDemo(false); })
      .catch((e: Error) => {
        if (/Forbidden|Unauthorized/i.test(e.message)) return setDenied(true); // real API said no: never fall back to demo data
        setDemo(true); setM(DEMO_M); setBiz(DEMO_B); setPlans(DEMO_P);
      });
  }, []);
  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>, demoFn: () => void) {
    setMsg('');
    if (demo) return demoFn();
    try { await fn(); load(); } catch (e) { setMsg((e as Error).message); }
  }
  const toggle = (b: Biz) => run(() => api(`/admin/businesses/${b.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: b.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }) }), () => setBiz((bs) => bs.map((x) => (x.id === b.id ? { ...x, status: x.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : x))));
  const assign = (b: Biz, slug: string) => run(() => api(`/admin/businesses/${b.id}/subscription`, { method: 'POST', body: JSON.stringify({ planSlug: slug, interval: 'MONTHLY' }) }), () => setMsg('Demostración: asignación simulada.'));
  const setPrice = (p: Plan, price: number) => run(() => api(`/admin/plans/${p.id}`, { method: 'PATCH', body: JSON.stringify({ price }) }), () => setPlans((ps) => ps.map((x) => (x.id === p.id ? { ...x, price } : x))));

  if (denied) return <main className="mx-auto max-w-md p-10"><Logo /><p className="card mt-8">No tienes acceso a esta sección.</p></main>;
  if (!m) return <p className="p-8 text-slate-500">Cargando…</p>;

  const cards: [string, string][] = [['MRR', money(m.mrr)], ['ARR', money(m.arr)], ['ARPU', money(m.arpu)], ['Churn 30 días', pct(m.churn30d)], ['Conversión', pct(m.conversion)], ['Suscripciones activas', String(m.activeSubscriptions)], ['En prueba', String(m.trialing)], ['Negocios nuevos (30 d)', String(m.newBusinesses30d)]];
  const slugs = [...new Set(plans.map((p) => p.slug))];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between"><Logo /><span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Admin</span></div>
      <h1 className="mt-6 text-2xl font-bold">Panel de administración</h1>
      {demo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Modo demostración: datos de ejemplo, sin API conectada.</p>}
      {msg && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{msg}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([l, v]) => <div key={l} className="card !p-4"><p className="text-xs text-slate-500">{l}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>)}</div>

      <h2 className="mt-8 text-lg font-bold">Negocios ({m.totalBusinesses})</h2>
      <div className="card mt-3 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500"><tr><th className="p-3">Negocio</th><th>Dueño</th><th>Plan</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{biz.map((b) => (
            <tr key={b.id} className="border-b border-slate-100">
              <td className="p-3"><b>{b.name}</b><br /><span className="text-xs text-slate-500">{b.category}</span></td>
              <td>{b.members[0]?.user.name}<br /><span className="text-xs text-slate-500">{b.members[0]?.user.email}</span></td>
              <td>{b.subscriptions[0] ? `${b.subscriptions[0].plan.name} · ${b.subscriptions[0].status}` : '—'}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-xs ${b.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{b.status === 'ACTIVE' ? 'Activo' : 'Suspendido'}</span></td>
              <td className="space-x-2 whitespace-nowrap py-2">
                <select defaultValue="" onChange={(e) => { if (e.target.value) { assign(b, e.target.value); e.target.value = ''; } }} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"><option value="" disabled>Asignar plan…</option>{slugs.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                <button onClick={() => toggle(b)} className="btn !px-3 !py-1 text-xs">{b.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}</button>
              </td>
            </tr>))}</tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-bold">Planes y precios</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{plans.map((p) => (
        <div key={p.id} className="card !p-4">
          <p className="font-semibold">{p.name}</p><p className="text-xs text-slate-500">{p.billingInterval === 'MONTHLY' ? 'Mensual' : 'Anual'}</p>
          <input type="number" min={0} step="0.01" defaultValue={Number(p.price)} onBlur={(e) => Number(e.target.value) !== Number(p.price) && setPrice(p, Number(e.target.value))} className="input mt-2" aria-label={`Precio ${p.name}`} />
        </div>))}</div>
      <p className="mt-2 text-xs text-slate-500">Los cambios de precio se guardan al salir del campo y aplican a nuevos cobros.</p>
    </main>
  );
}
