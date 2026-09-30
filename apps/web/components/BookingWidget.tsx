'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SiteItem } from '@/lib/site';

/** Public booking. With `host` it talks to the API; without it (demos) it shows sample slots. */
export function BookingWidget({ host, services, color }: { host?: string; services: SiteItem[]; color: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setSlot('');
    if (!serviceId) return;
    if (!host) { // demo: 10:00–13:30 every 30 min, as if in local time
      setSlots(Array.from({ length: 8 }, (_, i) => new Date(`${date}T${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00`).toISOString()));
      return;
    }
    api<{ slots: string[] }>(`/public/sites/${encodeURIComponent(host)}/availability?serviceId=${serviceId}&date=${date}`)
      .then((r) => setSlots(r.slots)).catch(() => setSlots([]));
  }, [host, serviceId, date]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('loading'); setMsg('');
    if (!host) { setState('done'); setMsg('Esto es una demostración: la cita no se guardó.'); return; }
    try {
      await api(`/public/sites/${encodeURIComponent(host)}/appointments`, {
        method: 'POST', body: JSON.stringify({ serviceId, startAt: slot, name: f.get('name'), phone: f.get('phone') }),
      });
      setState('done'); setMsg('¡Listo! Recibimos tu solicitud y te confirmaremos pronto.');
    } catch (err) { setState('error'); setMsg((err as Error).message); }
  }

  if (services.length === 0) return null;
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <section id="reservar" className="mx-auto max-w-5xl px-4 py-14">
      <h2 className="text-2xl font-bold">Reserva tu cita</h2>
      {state === 'done' ? (
        <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{msg}</p>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 p-4 shadow-sm sm:grid-cols-2">
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input">
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">Horarios disponibles</p>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button type="button" key={s} onClick={() => setSlot(s)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${slot === s ? 'text-white' : 'border-slate-300'}`}
                  style={slot === s ? { background: color, borderColor: color } : undefined}>{fmt(s)}</button>
              ))}
              {slots.length === 0 && <p className="text-sm text-slate-500">No hay horarios para ese día.</p>}
            </div>
          </div>
          <input name="name" required minLength={2} placeholder="Tu nombre" className="input" />
          <input name="phone" required placeholder="Tu teléfono" className="input" />
          {state === 'error' && <p className="text-sm text-red-600 sm:col-span-2">{msg}</p>}
          <button disabled={!slot || state === 'loading'} className="btn sm:col-span-2 !text-white disabled:opacity-50" style={{ background: color }}>
            {state === 'loading' ? 'Reservando…' : 'Reservar'}
          </button>
        </form>
      )}
    </section>
  );
}
