'use client';
import { useCallback, useEffect, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

type Status = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
interface Appt { id: string; startAt: string; endAt: string; status: Status; customer?: { name: string; phone?: string } | null; service?: { name: string } | null; employee?: { name: string } | null }

const LABEL: Record<Status, string> = { pending: 'Pendiente', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió' };
const COLOR: Record<Status, string> = { pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-blue-100 text-blue-800', completed: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-slate-200 text-slate-600', no_show: 'bg-red-100 text-red-700' };
const NEXT: Record<Status, [Status, string][]> = {
  pending: [['confirmed', 'Confirmar'], ['cancelled', 'Cancelar']],
  confirmed: [['completed', 'Completar'], ['no_show', 'No asistió'], ['cancelled', 'Cancelar']],
  completed: [], cancelled: [], no_show: [],
};

const iso = (h: number, m = 0, addDays = 0) => { const d = new Date(); d.setDate(d.getDate() + addDays); d.setHours(h, m, 0, 0); return d.toISOString(); };
const DEMO: Appt[] = [
  { id: '1', startAt: iso(10), endAt: iso(11), status: 'confirmed', customer: { name: 'Ana Pérez', phone: '55 1234 5678' }, service: { name: 'Corte clásico' }, employee: { name: 'Luis' } },
  { id: '2', startAt: iso(12, 30), endAt: iso(13, 30), status: 'pending', customer: { name: 'Carlos Ruiz' }, service: { name: 'Corte + barba' }, employee: { name: 'Luis' } },
  { id: '3', startAt: iso(9, 0, 1), endAt: iso(9, 45, 1), status: 'pending', customer: { name: 'María López' }, service: { name: 'Barba y toalla caliente' } },
];

export default function Citas() {
  const [items, setItems] = useState<Appt[]>([]);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const from = new Date().toISOString().slice(0, 10);
    api<Appt[]>(`/appointments?from=${from}`).then((r) => { setItems(r); setDemo(false); }).catch(() => { setDemo(true); setItems(DEMO); });
  }, []);
  useEffect(load, [load]);

  async function move(id: string, status: Status) {
    setError('');
    if (demo) return setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    try { await api(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); load(); }
    catch (e) { setError((e as Error).message); }
  }

  const byDay = items.reduce<Record<string, Appt[]>>((acc, a) => { const k = new Date(a.startAt).toDateString(); (acc[k] ||= []).push(a); return acc; }, {});
  const time = (s: string) => new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Citas</h1>
      {demo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Modo demostración: datos de ejemplo, sin API conectada.</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 space-y-6">
        {Object.entries(byDay).map(([day, list]) => (
          <div key={day}>
            <h2 className="mb-2 text-sm font-semibold text-slate-500 first-letter:uppercase">{new Date(day).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            <div className="space-y-2">
              {list.map((a) => (
                <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 !p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center"><p className="text-lg font-bold">{time(a.startAt)}</p><p className="text-xs text-slate-500">{time(a.endAt)}</p></div>
                    <div>
                      <p className="font-semibold">{a.customer?.name ?? 'Sin cliente'}</p>
                      <p className="text-sm text-slate-600">{a.service?.name}{a.employee ? ` · ${a.employee.name}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${COLOR[a.status]}`}>{LABEL[a.status]}</span>
                    {NEXT[a.status].map(([to, label]) => <button key={to} onClick={() => move(a.id, to)} className="btn !px-3 !py-1.5 text-xs">{label}</button>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-slate-500">No hay citas próximas.</p>}
      </div>
    </DashShell>
  );
}
