'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

interface Service { id: string; name: string; price: string | number; durationMin: number }
interface Employee { id: string; name: string }
interface Hours { weekday: number; openMin: number; closeMin: number }

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const money = (n: string | number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n));

const DEMO_S: Service[] = [{ id: 's1', name: 'Corte clásico', price: 150, durationMin: 30 }, { id: 's2', name: 'Corte + barba', price: 220, durationMin: 60 }];
const DEMO_E: Employee[] = [{ id: 'e1', name: 'Luis' }];
const DEMO_H: Hours[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, openMin: 540, closeMin: 1140 })).concat([{ weekday: 6, openMin: 600, closeMin: 900 }]);

export default function Servicios() {
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [hours, setHours] = useState<Record<number, { open: string; close: string } | null>>({});
  const [demo, setDemo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fill = (hs: Hours[]) => setHours(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => { const h = hs.find((x) => x.weekday === d); return [d, h ? { open: toTime(h.openMin), close: toTime(h.closeMin) } : null]; })));
  const load = useCallback(() => {
    Promise.all([api<Service[]>('/services'), api<Employee[]>('/employees'), api<Hours[]>('/business-hours')])
      .then(([s, e, h]) => { setServices(s); setEmployees(e); fill(h); setDemo(false); })
      .catch(() => { setDemo(true); setServices(DEMO_S); setEmployees(DEMO_E); fill(DEMO_H); });
  }, []);
  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>, demoFn: () => void, ok = '') {
    setMsg(null);
    if (demo) { demoFn(); return; }
    try { await fn(); if (ok) setMsg({ ok: true, text: ok }); load(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  const addService = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
    const body = { name: String(f.get('name')), price: Number(f.get('price')), durationMin: Number(f.get('duration')) };
    return run(() => api('/services', { method: 'POST', body: JSON.stringify(body) }), () => setServices((s) => [...s, { id: String(Date.now()), ...body }])).then(() => form.reset());
  };
  const addEmployee = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const name = String(new FormData(e.currentTarget).get('name')); const form = e.currentTarget;
    return run(() => api('/employees', { method: 'POST', body: JSON.stringify({ name }) }), () => setEmployees((x) => [...x, { id: String(Date.now()), name }])).then(() => form.reset());
  };
  const saveHours = () => {
    const days = ORDER.filter((d) => hours[d]).map((d) => ({ weekday: d, openMin: toMin(hours[d]!.open), closeMin: toMin(hours[d]!.close) }));
    if (days.some((d) => d.closeMin <= d.openMin)) return setMsg({ ok: false, text: 'La hora de cierre debe ser posterior a la de apertura' });
    return run(() => api('/business-hours', { method: 'PUT', body: JSON.stringify({ days }) }), () => setMsg({ ok: true, text: 'Demostración: no se guarda sin API.' }), 'Horario guardado');
  };

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Servicios, equipo y horarios</h1>
      {demo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Modo demostración: datos de ejemplo, sin API conectada.</p>}
      {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      <h2 className="mt-6 text-lg font-bold">Servicios</h2>
      <form onSubmit={addService} className="card mt-2 grid gap-3 sm:grid-cols-4">
        <input name="name" required placeholder="Nombre del servicio" className="input sm:col-span-2" />
        <input name="price" required type="number" step="0.01" min="0" placeholder="Precio" className="input" />
        <input name="duration" required type="number" min="5" max="720" step="5" placeholder="Minutos" className="input" />
        <button className="btn btn-primary sm:col-span-4">Agregar servicio</button>
      </form>
      <div className="card mt-3 divide-y divide-slate-100 !p-0">
        {services.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-3 text-sm">
            <span><b>{s.name}</b> <span className="text-slate-500">· {s.durationMin} min</span></span>
            <span className="flex items-center gap-3"><b>{money(s.price)}</b>
              <button className="text-xs text-red-600" onClick={() => run(() => api(`/services/${s.id}`, { method: 'DELETE' }), () => setServices((x) => x.filter((y) => y.id !== s.id)))}>Eliminar</button></span>
          </div>
        ))}
        {services.length === 0 && <p className="p-4 text-sm text-slate-500">Aún no hay servicios.</p>}
      </div>

      <h2 className="mt-8 text-lg font-bold">Equipo</h2>
      <form onSubmit={addEmployee} className="card mt-2 flex gap-3"><input name="name" required placeholder="Nombre del empleado" className="input" /><button className="btn btn-primary">Agregar</button></form>
      <div className="mt-3 flex flex-wrap gap-2">
        {employees.map((e) => (
          <span key={e.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm">{e.name}
            <button aria-label={`Quitar ${e.name}`} className="text-slate-400 hover:text-red-600" onClick={() => run(() => api(`/employees/${e.id}`, { method: 'DELETE' }), () => setEmployees((x) => x.filter((y) => y.id !== e.id)))}>×</button></span>
        ))}
        {employees.length === 0 && <p className="text-sm text-slate-500">Aún no hay empleados.</p>}
      </div>

      <h2 className="mt-8 text-lg font-bold">Horario de atención</h2>
      <div className="card mt-2 space-y-2">
        {ORDER.map((d) => (
          <div key={d} className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex w-32 items-center gap-2"><input type="checkbox" checked={!!hours[d]} onChange={(e) => setHours((h) => ({ ...h, [d]: e.target.checked ? { open: '09:00', close: '18:00' } : null }))} />{DAYS[d]}</label>
            {hours[d] ? (<>
              <input type="time" value={hours[d]!.open} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...h[d]!, open: e.target.value } }))} className="rounded-lg border border-slate-300 px-2 py-1" />
              <span>a</span>
              <input type="time" value={hours[d]!.close} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...h[d]!, close: e.target.value } }))} className="rounded-lg border border-slate-300 px-2 py-1" />
            </>) : <span className="text-slate-400">Cerrado</span>}
          </div>
        ))}
        <button onClick={saveHours} className="btn btn-primary mt-2">Guardar horario</button>
      </div>
    </DashShell>
  );
}
