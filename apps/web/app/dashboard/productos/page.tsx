'use client';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

interface Product { id: string; name: string; sku: string | null; price: string; status: string; inventory: { stock: number; minStock: number } | null }
const money = (n: string | number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n));

export default function Productos() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ items: Product[] }>(`/products?q=${encodeURIComponent(q)}`).then((r) => setItems(r.items)).catch((e) => {
      if (e.message === 'Unauthorized') router.replace('/login'); else setError(e.message);
    });
  }, [q, router]);
  useEffect(load, [load]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError('');
    try {
      await api('/products', { method: 'POST', body: JSON.stringify({
        name: f.get('name'), price: Number(f.get('price')), sku: f.get('sku') || undefined, stock: Number(f.get('stock') || 0), minStock: Number(f.get('minStock') || 0),
      }) });
      e.currentTarget.reset(); load();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Productos</h1>
      <form onSubmit={add} className="card mt-4 grid gap-3 sm:grid-cols-6">
        <input name="name" required placeholder="Nombre" className="input sm:col-span-2" />
        <input name="price" required type="number" step="0.01" min="0" placeholder="Precio" className="input" />
        <input name="sku" placeholder="SKU" className="input" />
        <input name="stock" type="number" min="0" placeholder="Stock" className="input" />
        <input name="minStock" type="number" min="0" placeholder="Mín." className="input" />
        <button className="btn btn-primary sm:col-span-6">Agregar producto</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, SKU o código" className="input mt-4" />
      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500"><tr><th className="p-3">Nombre</th><th>SKU</th><th>Precio</th><th>Stock</th><th>Estado</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="p-3 font-medium">{p.name}</td><td>{p.sku ?? '—'}</td><td>{money(p.price)}</td>
                <td className={p.inventory && p.inventory.stock <= p.inventory.minStock ? 'font-semibold text-red-600' : ''}>{p.inventory?.stock ?? 0}</td>
                <td>{p.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Aún no hay productos.</td></tr>}
          </tbody>
        </table>
      </div>
    </DashShell>
  );
}
