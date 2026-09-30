'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

interface Coupon { id: string; code: string; kind: 'PERCENT' | 'FIXED'; value: string | number; usedCount: number; maxUses: number | null; active: boolean }
const DEMO: Coupon[] = [
  { id: '1', code: 'VERANO10', kind: 'PERCENT', value: 10, usedCount: 12, maxUses: 100, active: true },
  { id: '2', code: 'BIENVENIDA50', kind: 'FIXED', value: 50, usedCount: 4, maxUses: null, active: true },
];
const IDEAS = [
  { t: 'Recupera clientes', d: 'Escribe a quien no compra desde hace 60 días con un cupón.', tag: 'Segmento: inactivos 60 días' },
  { t: 'Promoción de fin de semana', d: 'Anuncia una oferta por WhatsApp a tus clientes frecuentes.', tag: 'Segmento: etiqueta "frecuente"' },
  { t: 'Agradece una compra', d: 'Automatiza un mensaje cuando se confirma un pago.', tag: 'Automatización: pago confirmado' },
];

export default function Marketing() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => { api<Coupon[]>('/coupons').then((r) => { setCoupons(r); setDemo(false); }).catch(() => { setDemo(true); setCoupons(DEMO); }); }, []);
  useEffect(load, [load]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError('');
    const body = { code: String(f.get('code')), kind: f.get('kind'), value: Number(f.get('value')), maxUses: f.get('maxUses') ? Number(f.get('maxUses')) : undefined };
    if (demo) { setCoupons((c) => [{ id: String(Date.now()), code: body.code.toUpperCase(), kind: body.kind as any, value: body.value, usedCount: 0, maxUses: body.maxUses ?? null, active: true }, ...c]); e.currentTarget.reset(); return; }
    try { await api('/coupons', { method: 'POST', body: JSON.stringify(body) }); e.currentTarget.reset(); load(); } catch (err) { setError((err as Error).message); }
  }

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Marketing</h1>
      {demo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Modo demostración: datos de ejemplo, sin API conectada.</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {IDEAS.map((i) => (
          <div key={i.t} className="card !p-4"><h3 className="font-bold">{i.t}</h3><p className="mt-1 text-sm text-slate-600">{i.d}</p><p className="mt-2 text-xs font-medium text-brand">{i.tag}</p></div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold">Cupones</h2>
      <form onSubmit={add} className="card mt-3 grid gap-3 sm:grid-cols-5">
        <input name="code" required pattern="[A-Za-z0-9_-]{3,30}" placeholder="CÓDIGO" className="input uppercase" />
        <select name="kind" className="input"><option value="PERCENT">% descuento</option><option value="FIXED">$ descuento</option></select>
        <input name="value" required type="number" step="0.01" min="0.01" placeholder="Valor" className="input" />
        <input name="maxUses" type="number" min="1" placeholder="Usos máx." className="input" />
        <button className="btn btn-primary">Crear cupón</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500"><tr><th className="p-3">Código</th><th>Descuento</th><th>Usos</th><th>Estado</th></tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="p-3 font-mono font-semibold">{c.code}</td>
                <td>{c.kind === 'PERCENT' ? `${Number(c.value)}%` : `$${Number(c.value)}`}</td>
                <td>{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
                <td>{c.active ? 'Activo' : 'Inactivo'}</td>
              </tr>
            ))}
            {coupons.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Aún no hay cupones.</td></tr>}
          </tbody>
        </table>
      </div>
    </DashShell>
  );
}
