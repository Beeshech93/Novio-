'use client';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

interface Customer { id: string; name: string; email: string | null; phone: string | null; totalSpent: string; ordersCount: number; tags: { tag: string }[] }

export default function Clientes() {
  const router = useRouter();
  const [items, setItems] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [inactive, setInactive] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const qs = new URLSearchParams({ q, ...(inactive && { inactiveDays: inactive }) });
    api<{ items: Customer[] }>(`/customers?${qs}`).then((r) => setItems(r.items)).catch((e) => {
      if (e.message === 'Unauthorized') router.replace('/login'); else setError(e.message);
    });
  }, [q, inactive, router]);
  useEffect(load, [load]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const tags = String(f.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean);
    setError('');
    try {
      await api('/customers', { method: 'POST', body: JSON.stringify({
        name: f.get('name'), email: f.get('email') || undefined, phone: f.get('phone') || undefined, tags,
      }) });
      e.currentTarget.reset(); load();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Clientes</h1>
      <form onSubmit={add} className="card mt-4 grid gap-3 sm:grid-cols-4">
        <input name="name" required placeholder="Nombre" className="input" />
        <input name="email" type="email" placeholder="Correo" className="input" />
        <input name="phone" placeholder="Teléfono" className="input" />
        <input name="tags" placeholder="Etiquetas (vip, frecuente)" className="input" />
        <button className="btn btn-primary sm:col-span-4">Agregar cliente</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" className="input" />
        <select value={inactive} onChange={(e) => setInactive(e.target.value)} className="input sm:w-64">
          <option value="">Todos</option><option value="30">Sin comprar 30 días</option><option value="60">Sin comprar 60 días</option><option value="90">Sin comprar 90 días</option>
        </select>
      </div>
      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500"><tr><th className="p-3">Nombre</th><th>Contacto</th><th>Compras</th><th>Etiquetas</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="p-3 font-medium">{c.name}</td><td>{c.email ?? c.phone ?? '—'}</td><td>{c.ordersCount}</td>
                <td>{c.tags.map((t) => <span key={t.tag} className="mr-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{t.tag}</span>)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Aún no hay clientes.</td></tr>}
          </tbody>
        </table>
      </div>
    </DashShell>
  );
}
