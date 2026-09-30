import { PrismaClient, BillingInterval } from '@prisma/client';
import { ensureAdmin } from '../src/common/admin-promote';

const prisma = new PrismaClient();

// Initial plans. Prices live in the DB and are editable from the admin panel.
const PLANS = [
  { name: 'Nuvio Básico', slug: 'basico', monthly: 199, yearly: 1990, features: ['website', 'products', 'customers', 'orders'] },
  { name: 'Nuvio Profesional', slug: 'profesional', monthly: 399, yearly: 3990, features: ['website', 'products', 'customers', 'orders', 'appointments', 'whatsapp', 'inventory', 'ecommerce', 'analytics'] },
  { name: 'Nuvio Negocio', slug: 'negocio', monthly: 799, yearly: 7990, features: ['website', 'products', 'customers', 'orders', 'appointments', 'whatsapp', 'inventory', 'ecommerce', 'analytics', 'invoices', 'marketing', 'automation', 'advanced_reports'] },
];

async function main() {
  for (const p of PLANS) {
    for (const [interval, price] of [[BillingInterval.MONTHLY, p.monthly], [BillingInterval.YEARLY, p.yearly]] as const) {
      await prisma.plan.upsert({
        where: { slug_billingInterval: { slug: p.slug, billingInterval: interval } },
        update: {},
        create: { name: p.name, slug: p.slug, billingInterval: interval, price, currency: 'MXN', features: p.features },
      });
    }
  }
}

// Platform admin: driven by ADMIN_EMAIL (+ optional ADMIN_PASSWORD). See src/common/admin-promote.ts.
async function seedAdmin() {
  const r = await ensureAdmin(prisma as never);
  console.log(`SUPER_ADMIN: ${r}${r === 'not-registered' ? ' (register that email in the app first, then redeploy)' : ''}`);
}

main().then(seedAdmin).finally(() => prisma.$disconnect());
