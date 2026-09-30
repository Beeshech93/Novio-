'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

interface Me { name: string; businesses: { id: string; name: string; slug: string; role: string }[] }
interface Summary { salesToday: number; salesMonth: number; ordersMonth: number; newCustomersMonth: number; upcomingAppointments: number; lowStockProducts: number }

const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me>();
  const [s, setS] = useState<Summary>();

  useEffect(() => {
    Promise.all([api<Me>('/auth/me'), api<Summary>('/dashboard/summary')])
      .then(([m, sum]) => { setMe(m); setS(sum); })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!me || !s) return <p className="p-8 text-slate-500">Cargando…</p>;

  const cards: [string, string][] = [
    ['Ventas del día', money(s.salesToday)], ['Ventas del mes', money(s.salesMonth)],
    ['Pedidos del mes', String(s.ordersMonth)], ['Clientes nuevos', String(s.newCustomersMonth)],
    ['Citas próximas', String(s.upcomingAppointments)], ['Poco inventario', String(s.lowStockProducts)],
  ];

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Hola, {me.name} 👋</h1>
      <p className="text-slate-600">{me.businesses[0]?.name}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="card"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-extrabold">{value}</p></div>
        ))}
      </div>
    </DashShell>
  );
}
