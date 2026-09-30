'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

const GOALS = [
  'Quiero vender productos', 'Quiero recibir clientes', 'Quiero recibir pagos',
  'Quiero administrar citas', 'Quiero conseguir clientes', 'Quiero crear una página web',
];
const CATEGORIES = ['restaurante', 'barbería', 'salón', 'tienda', 'taller', 'veterinaria', 'gimnasio', 'profesional', 'otro'];

export default function Registro() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [acc, setAcc] = useState({ name: '', email: '', phone: '', password: '' });
  const [biz, setBiz] = useState({ name: '', category: 'tienda', city: '', phone: '', whatsapp: '', address: '', email: '' });
  const [goals, setGoals] = useState<string[]>([]);

  const clean = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v.trim() !== ''));

  async function finish() {
    setBusy(true); setError('');
    try {
      await api('/auth/register', { method: 'POST', body: JSON.stringify({ ...clean(acc), business: clean(biz), goals }) });
      router.push('/dashboard');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const field = (obj: Record<string, string>, set: (v: any) => void, key: string, ph: string, type = 'text', required = false) => (
    <input key={key} type={type} required={required} placeholder={ph} value={obj[key]} className="input"
      onChange={(e) => set({ ...obj, [key]: e.target.value })} />
  );

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Logo />
      <div className="card mt-8 space-y-4">
        <p className="text-sm font-medium text-slate-500">Paso {step} de 3</p>
        {step === 1 && (<>
          <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
          {field(acc, setAcc, 'name', 'Nombre', 'text', true)}
          {field(acc, setAcc, 'email', 'Correo', 'email', true)}
          {field(acc, setAcc, 'phone', 'Teléfono', 'tel')}
          {field(acc, setAcc, 'password', 'Contraseña (mín. 8 caracteres)', 'password', true)}
          <button className="btn btn-primary w-full" disabled={!acc.name || !acc.email || acc.password.length < 8} onClick={() => setStep(2)}>Continuar</button>
        </>)}
        {step === 2 && (<>
          <h1 className="text-2xl font-bold">Tu negocio</h1>
          {field(biz, setBiz, 'name', 'Nombre del negocio', 'text', true)}
          <select className="input" value={biz.category} onChange={(e) => setBiz({ ...biz, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {field(biz, setBiz, 'city', 'Ciudad')}
          {field(biz, setBiz, 'phone', 'Teléfono', 'tel')}
          {field(biz, setBiz, 'whatsapp', 'WhatsApp', 'tel')}
          {field(biz, setBiz, 'address', 'Dirección')}
          {field(biz, setBiz, 'email', 'Correo del negocio', 'email')}
          <div className="flex gap-2">
            <button className="btn" onClick={() => setStep(1)}>Atrás</button>
            <button className="btn btn-primary flex-1" disabled={!biz.name} onClick={() => setStep(3)}>Continuar</button>
          </div>
        </>)}
        {step === 3 && (<>
          <h1 className="text-2xl font-bold">¿Qué quieres lograr?</h1>
          {GOALS.map((g) => (
            <label key={g} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <input type="checkbox" checked={goals.includes(g)} onChange={() => setGoals(goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g])} />
              {g}
            </label>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn" onClick={() => setStep(2)}>Atrás</button>
            <button className="btn btn-primary flex-1" disabled={busy} onClick={finish}>{busy ? 'Creando…' : 'Crear mi negocio'}</button>
          </div>
        </>)}
        <p className="text-center text-sm text-slate-600">¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-brand">Inicia sesión</Link></p>
      </div>
    </main>
  );
}
