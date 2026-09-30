import { PublicSite, SiteItem, TEMPLATES, safeUrl, themeOf, waLink } from '@/lib/site';

const money = (n: string | number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n));

export function SiteRenderer({ site }: { site: PublicSite }) {
  const t = TEMPLATES.find((x) => x.slug === site.templateSlug) ?? TEMPLATES[TEMPLATES.length - 1];
  const c = site.content;
  const { primary, accent } = themeOf(t, c);
  const items: SiteItem[] = t.itemsLabel === 'Productos' ? site.products : site.services.length ? site.services : site.products;
  const title = c.title || site.name;
  const wa = waLink(c.whatsapp, `Hola ${title}, quiero más información`);
  const logo = safeUrl(c.logoUrl);
  const photos = (c.photos ?? []).map(safeUrl).filter(Boolean) as string[];
  const socials = ([['Instagram', c.instagram], ['Facebook', c.facebook], ['TikTok', c.tiktok]] as const).filter(([, u]) => safeUrl(u));

  return (
    <div style={{ ['--p' as string]: primary, ['--a' as string]: accent }} className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            {logo ? <img src={logo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="text-xl">{(t as any).emoji}</span>}
            {title}
          </div>
          {wa && <a href={wa} className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: primary }}>{t.cta}</a>}
        </div>
      </header>

      <section className="px-4 py-20 text-center text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd 60%, ${accent}66)` }}>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{c.tagline || t.heroLabel}</h1>
          {c.description && <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">{c.description}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {wa && <a href={wa} className="rounded-xl px-6 py-3 font-semibold text-slate-900" style={{ background: accent }}>{t.cta}</a>}
            {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="rounded-xl border border-white/60 px-6 py-3 font-semibold">Llamar</a>}
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-bold">{t.itemsLabel}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              const img = safeUrl(it.imageUrl ?? undefined);
              return (
                <div key={it.id} className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                  {img && <img src={img} alt={it.name} className="h-40 w-full object-cover" />}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{it.name}</h3>
                      <span className="whitespace-nowrap font-bold" style={{ color: primary }}>{money(it.price)}</span>
                    </div>
                    {it.description && <p className="mt-1 text-sm text-slate-600">{it.description}</p>}
                    {it.durationMin && <p className="mt-2 text-xs text-slate-500">{it.durationMin} min</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 pb-14 sm:grid-cols-3">
          {photos.map((p) => <img key={p} src={p} alt="" className="aspect-square w-full rounded-xl object-cover" />)}
        </section>
      )}

      <section className="bg-slate-50 px-4 py-14">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
          {c.hours && c.hours.length > 0 && (
            <div>
              <h2 className="text-xl font-bold">Horarios</h2>
              <dl className="mt-3 space-y-1 text-sm">
                {c.hours.map((h) => <div key={h.day} className="flex justify-between border-b border-slate-200 py-1"><dt>{h.day}</dt><dd className="font-medium">{h.hours}</dd></div>)}
              </dl>
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold">Contacto</h2>
            <div className="mt-3 space-y-2 text-sm">
              {c.address && <p>📍 {c.address}{site.city ? `, ${site.city}` : ''}</p>}
              {safeUrl(c.mapsUrl) && <a href={safeUrl(c.mapsUrl)} className="font-semibold underline" style={{ color: primary }}>Ver en Google Maps</a>}
              {wa && <p><a href={wa} className="font-semibold underline" style={{ color: primary }}>Escríbenos por WhatsApp</a></p>}
              <div className="flex gap-3 pt-1">
                {socials.map(([n, u]) => <a key={n} href={safeUrl(u)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium">{n}</a>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {title} · Creado con <a href="https://nuvio.app" className="font-semibold">Nuvio</a>
      </footer>
    </div>
  );
}
