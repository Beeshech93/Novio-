export interface SiteTemplate { slug: string; name: string; category: string; primary: string; accent: string; heroLabel: string; itemsLabel: 'Productos' | 'Servicios' | 'Menú'; cta: string }

/** Built-in templates. `primary`/`accent` are defaults the business can override. */
export const TEMPLATES: SiteTemplate[] = [
  { slug: 'restaurante', name: 'Restaurante', category: 'restaurante', primary: '#c2410c', accent: '#fbbf24', heroLabel: 'Sabor que se disfruta', itemsLabel: 'Menú', cta: 'Pedir ahora' },
  { slug: 'barberia', name: 'Barbería', category: 'barbería', primary: '#111827', accent: '#d4a017', heroLabel: 'Estilo y precisión', itemsLabel: 'Servicios', cta: 'Reservar cita' },
  { slug: 'salon', name: 'Salón', category: 'salón', primary: '#be185d', accent: '#f9a8d4', heroLabel: 'Belleza a tu medida', itemsLabel: 'Servicios', cta: 'Reservar cita' },
  { slug: 'tienda', name: 'Tienda', category: 'tienda', primary: '#5b45ff', accent: '#22d3a6', heroLabel: 'Lo que buscas, aquí', itemsLabel: 'Productos', cta: 'Comprar' },
  { slug: 'taller', name: 'Taller', category: 'taller', primary: '#1d4ed8', accent: '#f59e0b', heroLabel: 'Tu vehículo en buenas manos', itemsLabel: 'Servicios', cta: 'Agendar revisión' },
  { slug: 'veterinaria', name: 'Veterinaria', category: 'veterinaria', primary: '#047857', accent: '#a7f3d0', heroLabel: 'Cuidamos a quien más quieres', itemsLabel: 'Servicios', cta: 'Agendar consulta' },
  { slug: 'gimnasio', name: 'Gimnasio', category: 'gimnasio', primary: '#b91c1c', accent: '#111827', heroLabel: 'Supera tus límites', itemsLabel: 'Servicios', cta: 'Empieza hoy' },
  { slug: 'profesional', name: 'Profesional', category: 'profesional', primary: '#0f766e', accent: '#99f6e4', heroLabel: 'Atención profesional', itemsLabel: 'Servicios', cta: 'Contactar' },
  { slug: 'servicios', name: 'Servicios', category: 'otro', primary: '#4338ca', accent: '#c7d2fe', heroLabel: 'Soluciones para ti', itemsLabel: 'Servicios', cta: 'Solicitar' },
];
