'use client';
import { useEffect, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

interface Overview {
  revenue: number; orders: number; averageTicket: number; newCustomers: number; recurringCustomers: number;
  salesByDay: { date: string; total: number }[]; topProducts: { name: string; quantity: number }[]; topServices: { name: string; appointments: number }[];
}
const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const day = (i: number) => new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10);
const DEMO: Overview = {
  revenue: 48250, orders: 96, averageTicket: 502.6, newCustomers: 31, recurringCustomers: 58,
  salesByDay: [2100, 3400, 2800, 4100, 3900, 5200, 4600, 2900, 3300, 4800, 5100, 3700, 4400, 4950].map((total, i) => ({ date: day(i), total })),
  topProducts: [{ name: 'Gel fijador', quantity: 42 }, { name: 'Cera mate', quantity: 31 }, { name: 'Aceite de barba', quantity: 22 }],
  topServices: [{ name: 'Corte clásico', appointments: 64 }, { name: 'Corte + barba', appointments: 41 }, { name: 'Barba y toalla', appointments: 18 }],
};

function Bars({ data }: { data: { date: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const W = 560, H = 160, gap = 6, bw = (W - gap * (data.length - 1)) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label="Ventas por día">
      {data.map((d, i) => {
        const h = (d.total / max) * H;
        return (
          <g key={d.date}>
            <rect x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={4} className="fill-brand"><title>{`${d.date}: ${money(d.total)}`}</title></rect>
            {(i % 2 === 0 || data.length < 8) && <text x={i * (bw + gap) + bw / 2} y={H + 16} textAnchor="middle" className="fill-slate-400 text-[10px]">{d.date.slice(5)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export default function Analytics() {
  const [o, setO] = useState<Overview>();
  const [demo, setDemo] = useState(false);
  useEffect(() => { api<Overview>('/analytics/overview').then(setO).catch(() => { setDemo(true); setO(DEMO); }); }, []);
  if (!o) return <DashShell><p className="text-slate-500">Cargando…</p></DashShell>;

  const cards: [string, string][] = [
    ['Ingresos (30 días)', money(o.revenue)], ['Pedidos', String(o.orders)], ['Ticket promedio', money(o.averageTicket)],
    ['Clientes nuevos', String(o.newCustomers)], ['Clientes recurrentes', String(o.recurringCustomers)],
  ];
  const rank = (title: string, rows: { name: string; n: number }[]) => (
    <div className="card">
      <h2 className="font-bold">{title}</h2>
      <ol className="mt-3 space-y-2 text-sm">
        {rows.map((r, i) => <li key={r.name} className="flex justify-between border-b border-slate-100 pb-1"><span>{i + 1}. {r.name}</span><b>{r.n}</b></li>)}
        {rows.length === 0 && <li className="text-slate-500">Sin datos todavía.</li>}
      </ol>
    </div>
  );

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Analytics</h1>
      {demo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Modo demostración: datos de ejemplo, sin API conectada.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([l, v]) => <div key={l} className="card !p-4"><p className="text-xs text-slate-500">{l}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>)}
      </div>
      <div className="card mt-4"><h2 className="mb-2 font-bold">Ventas por día</h2><Bars data={o.salesByDay} /></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {rank('Productos más vendidos', o.topProducts.map((p) => ({ name: p.name, n: p.quantity })))}
        {rank('Servicios más solicitados', o.topServices.map((s) => ({ name: s.name, n: s.appointments })))}
      </div>
    </DashShell>
  );
}
