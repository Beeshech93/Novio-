import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nuvio — Haz crecer tu negocio',
  description: 'Digitaliza, administra, vende y haz crecer tu negocio desde un solo lugar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
