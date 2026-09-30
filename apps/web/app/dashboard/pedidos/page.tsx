'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

type OStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
interface Payment { id: string; method: string; status: string; amount: string | number }
interface Order { id: string; status: OStatus; total: string | number; createdAt: string; customer?: { name: string } | null; items: { id: string; name: string; quantity: number }[]; payments: Payment[] }
interface Product { id: string; name: string; price: string | number }

const LABEL: Record<OStatus, string> = { NEW: 'Nuevo', CONFIRMED: 'Confirmado', PREPARING: 'Preparando', SHIPPED: 'Enviado', COMPLETED: 'Completado', CANCELLED: 'Cancelado', REFUNDED: 'Reembolsado' };
const COLOR: Record<OStatus, string> = { NEW: 'bg-blue-100 text-blue-800', CONFIRMED: 'bg-indigo-100 text-indigo-800', PREPARING: 'bg-amber-100 text-amber-800', SHIPPED: 'bg-cyan-100 text-cyan-800', COMPLETED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-slate-200 text-slate-600', REFUNDED: 'bg-red-100 text-red-700' };
// Mirrors the API state machine (the server is the source of truth and re-validates).
const NEXT: Record<OStatus, [OStatus, string][]> = {
  NEW: [['CONFIRMED', 'Confirmar'], ['CANCELLED', 'Cancelar']], CONFIRMED: [['PREPARING', 'Preparar'], ['COMPLETED', 'Completar'], ['CANCELLED', 'Cancelar']],
  PREPARING: [['SHIPPED', 'Enviar'], ['COMPLETED', 'Completar'], ['CANCELLED', 'Cancelar']], SHIPPED: [['COMPLETED', 'Completar']], COMPLETED: [['REFUNDED', 'Reembolsar']], CANCELLED: [], REFUNDED: [],
};
const METHODS: [string, string][] = [['IN_STORE', 'En tienda'], ['TRANSFER', 'Transferencia'], ['CARD', 'Tarjeta (en línea)'], ['PAYMENT_LINK', 'Link de pago']];
const money = (n: string | number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n));
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const DEMO_PRODUCTS: Product[] = [{ id: 'p1', name: 'Gel fijador', price: 120 }, { id: 'p2', name: 'Cera mate', price: 150 }, { id: 'p3', name: 'Aceite de barba', price: 220 }];
const DEMO: Order[] = [
  { id: 'a1b2c3d4-0000', status: 'NEW', total: 340, createdAt: ago(1), customer: { name: 'Ana Pérez' }, items: [{ id: '1', name: 'Gel fijador', quantity: 1 }, { id: '2', name: 'Aceite de barba', quantity: 1 }], payments: [] },
  { id: 'e5f6a7b8-0000', status: 'CONFIRMED', total: 300, createdAt: ago(5), customer: { name: 'Carlos Ruiz' }, items: [{ id: '3', name: 'Cera mate', quantity: 2 }], payments: [{ id: 'x', method: 'CARD', status: 'SUCCEEDED', amount: 300 }] },
];

export default function Pedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [pid, setPid] = useState('');
  const [qty, setQty] = useState(1);
  const [coupon, setCoupon] = useState('');

  const load = useCallback(() => {
    Promise.all([api<{ items: Order[] }>('/orders'), api<{ items: Product[] }>('/products')])
      .then(([o, p]) => { setOrders(o.items); setProducts(p.items); setDemo(false); })
      .catch(() => { setDemo(true); setOrders(DEMO); setProducts(DEMO_PRODUCTS); });
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (!pid && products[0]) setPid(products[0].id); }, [products, pid]);

  async function act(fn: () => Promise<unknown>, demoFn: () => void, okNote = '') {
    setError(''); setNote('');
    if (demo) { demoFn(); return; }
    try { await fn(); if (okNote) setNote(okNote); load(); } catch (e) { setError((e as Error).message); }
  }

  const create = (e: FormEvent) => {
    e.preventDefault();
    const p = products.find((x) => x.id === pid);
    return act(
      () => api('/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: pid, quantity: qty }], couponCode: coupon || undefined }) }),
      () => setOrders((os) => [{ id: `demo-${Date.now()}`, status: 'NEW', total: Number(p?.price ?? 0) * qty, createdAt: new Date().toISOString(), items: [{ id: 'n', name: p?.name ?? '', quantity: qty }], payments: [] }, ...os]),
    );
  };
  const move = (o: Order, to: OStatus) => act(() => api(`/orders/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: to }) }), () => setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status: to } : x))));
  const pay = (o: Order, method: string) => act(
    async () => {
      const r = await api<{ payment: Payment; checkoutUrl: string | null }>('/payments', { method: 'POST', body: JSON.stringify({ orderId: o.id, method }) });
      if (r.checkoutUrl) setNote(`Link de pago: ${r.checkoutUrl}`);
      else await api(`/payments/${r.payment.id}/confirm`, { method: 'POST' }); // in-store / transfer: staff confirms
    },
    () => setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status: x.status === 'NEW' ? 'CONFIRMED' : x.status, payments: [...x.payments, { id: String(Date.now()), method, status: 'SUCCEEDED', amount: o.total }] } : x))),
  );
  const paid = (o: Order) => o.payments.filter((p) => p.status === 'SUCCEEDED').reduce((s, p) => s + Number(p.amount), 0) >= Number(o.total);

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Pedidos y pagos</h1>
      {demo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Modo demostración: datos de ejemplo, sin API conectada.</p>}
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {note && <p className="mt-3 break-all rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{note}</p>}

      <form onSubmit={create} className="card mt-4 grid gap-3 sm:grid-cols-5">
        <select value={pid} onChange={(e) => setPid(e.target.value)} className="input sm:col-span-2">{products.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}</select>
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="input" aria-label="Cantidad" />
        <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Cupón (opcional)" className="input uppercase" />
        <button className="btn btn-primary" disabled={!pid}>Crear pedido</button>
      </form>

      <div className="mt-4 space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="card !p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">#{o.id.slice(0, 8)} · {o.customer?.name ?? 'Sin cliente'}</p>
                <p className="text-sm text-slate-600">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                <p className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleString('es-MX')}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold">{money(o.total)}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${COLOR[o.status]}`}>{LABEL[o.status]}</span>
                <p className={`mt-1 text-xs ${paid(o) ? 'text-emerald-600' : 'text-amber-600'}`}>{paid(o) ? 'Pagado' : 'Pago pendiente'}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {NEXT[o.status].map(([to, label]) => <button key={to} onClick={() => move(o, to)} className="btn !px-3 !py-1.5 text-xs">{label}</button>)}
              {!paid(o) && !['CANCELLED', 'REFUNDED'].includes(o.status) && (
                <select defaultValue="" onChange={(e) => { if (e.target.value) { pay(o, e.target.value); e.target.value = ''; } }} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs">
                  <option value="" disabled>Registrar pago…</option>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              )}
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-slate-500">Aún no hay pedidos.</p>}
      </div>
    </DashShell>
  );
}
