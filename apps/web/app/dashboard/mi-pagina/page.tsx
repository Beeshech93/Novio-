'use client';
import { useEffect, useMemo, useState } from 'react';
import { DashShell } from '@/components/DashShell';
import { ImageUpload } from '@/components/ImageUpload';
import { SiteRenderer } from '@/components/SiteRenderer';
import { api } from '@/lib/api';
import { DEMOS, PublicSite, SiteContent, TEMPLATES } from '@/lib/site';

interface ApiSite { subdomain: string; published: boolean; content: SiteContent; template?: { slug: string } | null }

const DAYS: [string, string][] = [['Lun–Vie', '9:00 – 19:00'], ['Sábado', '10:00 – 15:00'], ['Domingo', 'Cerrado']];

export default function MiPagina() {
  const [template, setTemplate] = useState('barberia');
  const [content, setContent] = useState<SiteContent>(DEMOS.barberia.content);
  const [subdomain, setSubdomain] = useState('mi-negocio');
  const [published, setPublished] = useState(false);
  const [demo, setDemo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    api<ApiSite>('/website')
      .then((s) => {
        if (s.template?.slug) setTemplate(s.template.slug);
        setContent({ hours: DAYS.map(([day, hours]) => ({ day, hours })), ...s.content });
        setSubdomain(s.subdomain); setPublished(s.published);
      })
      .catch(() => setDemo(true)); // no API / not signed in: edit a local demo
  }, []);

  const set = (k: keyof SiteContent, v: string) => setContent((c) => ({ ...c, [k]: v }));
  const pickTemplate = (slug: string) => {
    const t = TEMPLATES.find((x) => x.slug === slug)!;
    setTemplate(slug);
    setContent((c) => ({ ...c, primaryColor: t.primary, accentColor: t.accent, tagline: c.tagline && !TEMPLATES.some((x) => x.heroLabel === c.tagline) ? c.tagline : t.heroLabel }));
  };

  const site: PublicSite = useMemo(() => ({
    name: content.title || 'Mi negocio', category: template, city: null, templateSlug: template, content,
    products: DEMOS[template].products, services: DEMOS[template].services,
  }), [content, template]);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const { hours, ...rest } = content;
      // Empty strings are dropped: the API validates formats and rejects "".
      const clean = Object.fromEntries(Object.entries({ ...rest, hours }).filter(([, v]) => v !== '' && v !== undefined));
      await api('/website', { method: 'PATCH', body: JSON.stringify({ templateSlug: template, subdomain, published, content: clean }) });
      setMsg({ ok: true, text: 'Cambios guardados' });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const field = (label: string, key: keyof SiteContent, ph = '', area = false) => (
    <label className="block text-sm font-medium">
      {label}
      {area
        ? <textarea rows={3} className="input mt-1 font-normal" placeholder={ph} value={(content[key] as string) ?? ''} onChange={(e) => set(key, e.target.value)} />
        : <input className="input mt-1 font-normal" placeholder={ph} value={(content[key] as string) ?? ''} onChange={(e) => set(key, e.target.value)} />}
    </label>
  );

  return (
    <DashShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Mi página</h1>
        <div className="flex gap-1 lg:hidden">
          {(['edit', 'preview'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`btn !px-3 !py-1.5 text-sm ${tab === t ? '!bg-brand !text-white' : ''}`}>{t === 'edit' ? 'Editar' : 'Vista previa'}</button>
          ))}
        </div>
      </div>
      {demo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Modo demostración: no hay una API conectada, así que puedes editar y ver el resultado, pero no se guarda.</p>}

      <div className="mt-4 grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className={`space-y-4 ${tab === 'preview' ? 'hidden lg:block' : ''}`}>
          <div className="card space-y-3">
            <p className="text-sm font-semibold">Plantilla</p>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.slug} onClick={() => pickTemplate(t.slug)} className={`rounded-xl border p-2 text-xs ${template === t.slug ? 'border-brand bg-brand/10 font-semibold' : 'border-slate-200'}`}>
                  <div className="text-xl">{t.emoji}</div>{t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="card space-y-3">
            {field('Nombre del negocio', 'title')}
            {field('Frase principal', 'tagline')}
            {field('Descripción', 'description', '', true)}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Color principal<input type="color" className="mt-1 h-11 w-full rounded-xl border border-slate-300" value={content.primaryColor ?? TEMPLATES.find((t) => t.slug === template)!.primary} onChange={(e) => set('primaryColor', e.target.value)} /></label>
              <label className="text-sm font-medium">Color de acento<input type="color" className="mt-1 h-11 w-full rounded-xl border border-slate-300" value={content.accentColor ?? TEMPLATES.find((t) => t.slug === template)!.accent} onChange={(e) => set('accentColor', e.target.value)} /></label>
            </div>
          </div>
          <div className="card space-y-3">
            <p className="text-sm font-semibold">Imágenes</p>
            <div className="flex flex-wrap items-center gap-3">
              {content.logoUrl && <img src={content.logoUrl} alt="Logo" className="h-12 w-12 rounded-full object-cover" />}
              <ImageUpload purpose="logo" label={content.logoUrl ? 'Cambiar logo' : 'Subir logo'} disabled={demo} onDone={(u) => set('logoUrl', u)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(content.photos ?? []).map((p) => (
                <span key={p} className="relative"><img src={p} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <button type="button" aria-label="Quitar foto" onClick={() => setContent((c) => ({ ...c, photos: (c.photos ?? []).filter((x) => x !== p) }))} className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-slate-900 text-xs text-white">×</button></span>
              ))}
              {(content.photos ?? []).length < 12 && <ImageUpload purpose="gallery" label="Agregar foto" disabled={demo} onDone={(u) => setContent((c) => ({ ...c, photos: [...(c.photos ?? []), u] }))} />}
            </div>
          </div>
          <div className="card space-y-3">
            {field('WhatsApp', 'whatsapp', '+5215512345678')}
            {field('Teléfono', 'phone')}
            {field('Dirección', 'address')}
            {field('Enlace de Google Maps', 'mapsUrl', 'https://maps.google.com/…')}
            {field('Instagram', 'instagram', 'https://instagram.com/…')}
            {field('Facebook', 'facebook', 'https://facebook.com/…')}
          </div>
          <div className="card space-y-3">
            <label className="block text-sm font-medium">Dirección web
              <div className="mt-1 flex items-center gap-2">
                <input className="input font-normal" value={subdomain} onChange={(e) => setSubdomain(e.target.value.toLowerCase())} />
                <span className="whitespace-nowrap text-sm text-slate-500">.nuvio.app</span>
              </div>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publicar mi página</label>
            {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
            <button className="btn btn-primary w-full" disabled={busy || demo} onClick={save}>{busy ? 'Guardando…' : demo ? 'Guardar (requiere API)' : 'Guardar cambios'}</button>
          </div>
        </div>

        <div className={`${tab === 'edit' ? 'hidden lg:block' : ''}`}>
          <div className="sticky top-4 overflow-hidden rounded-2xl border border-slate-300 shadow-lg">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 truncate rounded bg-white px-3 py-0.5 text-xs text-slate-500">https://{subdomain || 'mi-negocio'}.nuvio.app</span>
            </div>
            <div className="max-h-[80vh] overflow-y-auto"><SiteRenderer site={site} /></div>
          </div>
        </div>
      </div>
    </DashShell>
  );
}
