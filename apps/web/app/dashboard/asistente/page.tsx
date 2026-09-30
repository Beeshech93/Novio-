'use client';
import { FormEvent, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { api } from '@/lib/api';

const TASKS: [string, string][] = [
  ['campaign_pack', 'Paquete de campaña'], ['promotion', 'Promoción'], ['whatsapp_message', 'Mensaje de WhatsApp'],
  ['social_post', 'Publicación para redes'], ['email', 'Correo'], ['product_description', 'Descripción de producto'], ['reply', 'Responder a un cliente'],
];
const LABELS: Record<string, string> = { headline: 'Título', promotion: 'Promoción', whatsapp: 'WhatsApp', social_post: 'Publicación', cta: 'Llamado a la acción', text: 'Texto', hashtags: 'Hashtags', subject: 'Asunto' };
const DEMO: Record<string, string> = {
  headline: '¡Fin de semana de estilo!', promotion: 'Corte + barba con 15% de descuento sábado y domingo.',
  whatsapp: 'Hola 👋 Este fin de semana tenemos corte + barba con 15% de descuento. ¿Te reservamos un lugar?',
  social_post: '💈 Este fin de semana renueva tu look. Corte + barba con 15% off. #barbería #estilo', cta: 'Reserva tu cita hoy',
};

export default function Asistente() {
  const [task, setTask] = useState('campaign_pack');
  const [prompt, setPrompt] = useState('Quiero promocionar mi barbería este fin de semana.');
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [insights, setInsights] = useState<{ summary: string; actions: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const [copied, setCopied] = useState('');

  async function run(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setResult(null);
    try {
      const r = await api<{ result: Record<string, string> }>('/ai/generate', { method: 'POST', body: JSON.stringify({ task, prompt }) });
      setResult(r.result); setDemo(false);
    } catch (err) {
      const m = (err as Error).message;
      if (/fetch|Failed|Unauthorized/i.test(m)) { setDemo(true); setResult(DEMO); } else setError(m);
    } finally { setBusy(false); }
  }
  async function analyze() {
    setBusy(true); setError('');
    try { setInsights(await api('/ai/insights', { method: 'POST' })); }
    catch (err) {
      const m = (err as Error).message;
      if (/fetch|Failed|Unauthorized/i.test(m)) { setDemo(true); setInsights({ summary: 'Ejemplo: tus ventas crecieron esta semana y el corte clásico es tu servicio más pedido.', actions: ['Lanza un paquete corte + barba los martes, el día más flojo.', 'Escribe a los clientes que no vienen desde hace 60 días con un cupón.', 'Pide reseñas a quienes completaron una cita esta semana.'] }); }
      else setError(m);
    } finally { setBusy(false); }
  }
  const copy = (k: string, v: string) => { navigator.clipboard?.writeText(v).then(() => { setCopied(k); setTimeout(() => setCopied(''), 1500); }); };

  return (
    <DashShell>
      <h1 className="text-2xl font-bold">Nuvio AI ✨</h1>
      <p className="text-slate-600">Cuéntame qué quieres lograr y creo el texto por ti.</p>
      {demo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Modo demostración: son resultados de ejemplo, la IA aún no está conectada.</p>}
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={run} className="card mt-4 space-y-3">
        <select value={task} onChange={(e) => setTask(e.target.value)} className="input">{TASKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} minLength={3} maxLength={1500} required className="input" placeholder="Ej. Quiero promocionar mi barbería este fin de semana" />
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className="btn btn-primary">{busy ? 'Pensando…' : 'Generar'}</button>
          <button type="button" disabled={busy} onClick={analyze} className="btn">Analizar mis ventas</button>
        </div>
      </form>

      {result && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(result).map(([k, v]) => (
            <div key={k} className="card !p-4">
              <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-brand">{LABELS[k] ?? k}</h3>
                <button onClick={() => copy(k, v)} className="text-xs font-medium text-slate-500 hover:text-slate-900">{copied === k ? '¡Copiado!' : 'Copiar'}</button></div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{v}</p>
            </div>
          ))}
        </div>
      )}

      {insights && (
        <div className="card mt-4">
          <h2 className="font-bold">Lo que veo en tu negocio</h2>
          <p className="mt-2 text-sm text-slate-700">{insights.summary}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{insights.actions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
    </DashShell>
  );
}
