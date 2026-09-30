export interface SiteItem { id: string; name: string; description?: string | null; price: string | number; compareAtPrice?: string | number | null; durationMin?: number; imageUrl?: string | null }
export interface SiteContent {
  title?: string; tagline?: string; description?: string; logoUrl?: string; photos?: string[];
  primaryColor?: string; accentColor?: string; hours?: { day: string; hours: string }[];
  address?: string; mapsUrl?: string; whatsapp?: string; phone?: string; instagram?: string; facebook?: string; tiktok?: string;
}
export interface PublicSite { name: string; category: string; city?: string | null; templateSlug: string; content: SiteContent; products: SiteItem[]; services: SiteItem[] }

export interface TemplateMeta { slug: string; name: string; primary: string; accent: string; heroLabel: string; itemsLabel: string; cta: string; emoji: string }
export const TEMPLATES: TemplateMeta[] = [
  { slug: 'restaurante', name: 'Restaurante', primary: '#c2410c', accent: '#fbbf24', heroLabel: 'Sabor que se disfruta', itemsLabel: 'Menú', cta: 'Pedir ahora', emoji: '🍽️' },
  { slug: 'barberia', name: 'Barbería', primary: '#111827', accent: '#d4a017', heroLabel: 'Estilo y precisión', itemsLabel: 'Servicios', cta: 'Reservar cita', emoji: '💈' },
  { slug: 'salon', name: 'Salón', primary: '#be185d', accent: '#f9a8d4', heroLabel: 'Belleza a tu medida', itemsLabel: 'Servicios', cta: 'Reservar cita', emoji: '💇' },
  { slug: 'tienda', name: 'Tienda', primary: '#5b45ff', accent: '#22d3a6', heroLabel: 'Lo que buscas, aquí', itemsLabel: 'Productos', cta: 'Comprar', emoji: '🛍️' },
  { slug: 'taller', name: 'Taller', primary: '#1d4ed8', accent: '#f59e0b', heroLabel: 'Tu vehículo en buenas manos', itemsLabel: 'Servicios', cta: 'Agendar revisión', emoji: '🔧' },
  { slug: 'veterinaria', name: 'Veterinaria', primary: '#047857', accent: '#a7f3d0', heroLabel: 'Cuidamos a quien más quieres', itemsLabel: 'Servicios', cta: 'Agendar consulta', emoji: '🐾' },
  { slug: 'gimnasio', name: 'Gimnasio', primary: '#b91c1c', accent: '#111827', heroLabel: 'Supera tus límites', itemsLabel: 'Servicios', cta: 'Empieza hoy', emoji: '🏋️' },
  { slug: 'profesional', name: 'Profesional', primary: '#0f766e', accent: '#99f6e4', heroLabel: 'Atención profesional', itemsLabel: 'Servicios', cta: 'Contactar', emoji: '💼' },
  { slug: 'servicios', name: 'Servicios', primary: '#4338ca', accent: '#c7d2fe', heroLabel: 'Soluciones para ti', itemsLabel: 'Servicios', cta: 'Solicitar', emoji: '✨' },
];

/** Only http(s) links are ever rendered as hrefs (blocks javascript:/data: even if bad data slips into the DB). */
export const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);
export const waLink = (n?: string, text?: string) => {
  const digits = (n ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}` : undefined;
};
const hex = (c: string | undefined, fb: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fb);
export const themeOf = (t: TemplateMeta, c: SiteContent) => ({ primary: hex(c.primaryColor, t.primary), accent: hex(c.accentColor, t.accent) });

export const DEMOS: Record<string, PublicSite> = Object.fromEntries(TEMPLATES.map((t) => {
  const services = t.itemsLabel !== 'Productos';
  const names: Record<string, string[]> = {
    restaurante: ['Tacos al pastor', 'Enchiladas verdes', 'Agua de horchata', 'Flan casero'],
    barberia: ['Corte clásico', 'Barba y toalla caliente', 'Corte + barba', 'Diseño de cejas'],
    salon: ['Corte y peinado', 'Color completo', 'Manicure', 'Tratamiento capilar'],
    tienda: ['Camiseta básica', 'Gorra urbana', 'Mochila', 'Botella térmica'],
    taller: ['Afinación mayor', 'Cambio de aceite', 'Frenos', 'Diagnóstico'],
    veterinaria: ['Consulta general', 'Vacunación', 'Baño y corte', 'Desparasitación'],
    gimnasio: ['Membresía mensual', 'Clase de spinning', 'Entrenador personal', 'Pase semanal'],
    profesional: ['Primera consulta', 'Sesión de seguimiento', 'Asesoría express', 'Paquete de 5 sesiones'],
    servicios: ['Visita técnica', 'Instalación', 'Mantenimiento', 'Cotización'],
  };
  const items: SiteItem[] = names[t.slug].map((n, i) => ({ id: String(i), name: n, price: 80 + i * 60, durationMin: services ? 30 + i * 15 : undefined, description: 'Descripción breve de ejemplo.' }));
  return [t.slug, {
    name: `${t.name} Demo`, category: t.slug, city: 'Ciudad de México', templateSlug: t.slug,
    content: {
      title: `${t.name} Demo`, tagline: t.heroLabel, description: 'Somos un negocio local con años de experiencia. Esta es una página de ejemplo creada con Nuvio.',
      hours: [{ day: 'Lun–Vie', hours: '9:00 – 19:00' }, { day: 'Sábado', hours: '10:00 – 15:00' }, { day: 'Domingo', hours: 'Cerrado' }],
      address: 'Av. Reforma 123, Col. Centro', whatsapp: '+5215512345678', instagram: 'https://instagram.com/nuvio',
    },
    products: services ? [] : items, services: services ? items : [],
  } as PublicSite];
}));
