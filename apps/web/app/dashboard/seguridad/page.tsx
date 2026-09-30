'use client';
import { FormEvent, useEffect, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

export default function Seguridad() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<{ twoFactorEnabled: boolean; emailVerified: boolean }>('/auth/me').then((m) => { setEnabled(m.twoFactorEnabled); setVerified(m.emailVerified); }).catch(() => setEnabled(null));
  useEffect(() => { load(); }, []);

  const fail = (e: unknown) => setMsg({ ok: false, text: (e as Error).message });
  async function start() { setBusy(true); setMsg(null); try { setSetup(await api('/auth/2fa/setup', { method: 'POST' })); } catch (e) { fail(e); } finally { setBusy(false); } }
  async function enable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { const r = await api<{ recoveryCodes: string[] }>('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code: new FormData(e.currentTarget).get('code') }) }); setCodes(r.recoveryCodes); setSetup(null); setEnabled(true); } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function disable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg(null); const f = new FormData(e.currentTarget);
    try { await api('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password: f.get('password'), code: f.get('code') }) }); setEnabled(false); setMsg({ ok: true, text: 'Verificación en dos pasos desactivada' }); } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function resend() { try { await api('/auth/verify-email/resend', { method: 'POST' }); setMsg({ ok: true, text: 'Te enviamos un nuevo enlace de verificación' }); } catch (e) { fail(e); } }

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Seguridad</h1>
      {enabled === null && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Esta sección necesita la API conectada y una sesión iniciada.</p>}
      {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      {verified === false && (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">Tu correo aún no está verificado.</p><button onClick={resend} className="btn text-sm">Reenviar verificación</button></div>
      )}

      {enabled !== null && (
        <div className="card mt-4 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-bold">Verificación en dos pasos</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{enabled ? 'Activada' : 'Desactivada'}</span></div>

          {codes && (
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Guarda estos códigos de recuperación. No volverás a verlos.</p>
              <p className="text-xs text-amber-800">Cada uno sirve una sola vez si pierdes tu teléfono.</p>
              <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
              <button className="btn mt-3 !px-3 !py-1.5 text-xs" onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}>Copiar códigos</button>
            </div>
          )}

          {!enabled && !setup && (<><p className="text-sm text-slate-600">Añade una capa extra: además de tu contraseña, se pedirá un código de tu app autenticadora (Google Authenticator, Authy, 1Password…).</p><button onClick={start} disabled={busy} className="btn btn-primary">Activar</button></>)}

          {setup && (
            <form onSubmit={enable} className="space-y-3">
              <p className="text-sm text-slate-600">1. Escanea el QR con tu app. 2. Escribe el código de 6 dígitos que muestra.</p>
              <img src={setup.qr} alt="Código QR para tu app autenticadora" className="h-44 w-44 rounded-lg border border-slate-200" />
              <p className="text-xs text-slate-500">¿No puedes escanear? Clave manual: <code className="font-mono">{setup.secret}</code></p>
              <input name="code" required pattern="\d{6}" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="input max-w-[200px] tracking-widest" />
              <button disabled={busy} className="btn btn-primary ml-2">Confirmar y activar</button>
            </form>
          )}

          {enabled && (
            <form onSubmit={disable} className="grid gap-3 sm:grid-cols-3">
              <input name="password" type="password" required placeholder="Tu contraseña" className="input" autoComplete="current-password" />
              <input name="code" required placeholder="Código de la app" className="input" autoComplete="one-time-code" />
              <button disabled={busy} className="btn">Desactivar</button>
            </form>
          )}
        </div>
      )}
    </DashShell>
  );
}
