import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { fetchJsonSafe } from '@/lib/api';

interface Plan { id: string; name: string; slug: string; billingInterval: 'MONTHLY' | 'YEARLY'; price: string; currency: string }

const getPlans = () => fetchJsonSafe<Plan[]>('/plans', []);

export default async function Precios() {
  const plans = await getPlans();
  const bySlug = new Map<string, Plan[]>();
  plans.forEach((p) => bySlug.set(p.slug, [...(bySlug.get(p.slug) ?? []), p]));
  const fmt = (p?: Plan) => (p ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(Number(p.price)) : '—');

  return (
    <main className="mx-auto max-w-5xl px-4">
      <header className="py-5"><Logo /></header>
      <h1 className="py-10 text-center text-4xl font-extrabold">Planes</h1>
      {plans.length === 0 && <p className="text-center text-slate-600">Los planes no están disponibles por ahora.</p>}
      <div className="grid gap-4 pb-16 md:grid-cols-3">
        {[...bySlug.entries()].map(([slug, ps]) => (
          <div key={slug} className="card">
            <h2 className="text-xl font-bold">{ps[0].name}</h2>
            <p className="mt-3 text-3xl font-extrabold">{fmt(ps.find((p) => p.billingInterval === 'MONTHLY'))}<span className="text-sm font-medium text-slate-500"> /mes</span></p>
            <p className="text-sm text-slate-500">o {fmt(ps.find((p) => p.billingInterval === 'YEARLY'))} al año</p>
            <Link href="/registro" className="btn btn-primary mt-5 w-full">Empezar</Link>
          </div>
        ))}
      </div>
    </main>
  );
}
