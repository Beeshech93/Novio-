'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

function Check() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  useEffect(() => {
    if (!token) return;
    api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }).then(() => setState('ok')).catch(() => setState('error'));
  }, [token]);

  if (state === 'loading') return <p className="text-slate-600">Verificando…</p>;
  if (state === 'ok') return <div className="space-y-3"><p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">¡Correo verificado! Tu cuenta está más segura.</p><Link href="/dashboard" className="btn btn-primary w-full">Ir a mi panel</Link></div>;
  return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">El enlace no es válido o ya expiró. Entra a tu panel para pedir uno nuevo.</p>;
}

export default function Verificar() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Logo />
      <div className="card mt-8 space-y-4"><h1 className="text-2xl font-bold">Verificar correo</h1><Suspense fallback={null}><Check /></Suspense></div>
    </main>
  );
}
