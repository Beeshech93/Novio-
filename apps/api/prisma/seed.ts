import { PrismaClient, BillingInterval } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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

// Platform admin is created only when ADMIN_EMAIL + ADMIN_PASSWORD are provided (never hardcoded).
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return console.log('ADMIN_EMAIL/ADMIN_PASSWORD not set: skipping SUPER_ADMIN');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  await prisma.user.upsert({
    where: { email }, update: { platformRole: 'SUPER_ADMIN' },
    create: { email, name: 'Nuvio Admin', passwordHash: await bcrypt.hash(password, 12), platformRole: 'SUPER_ADMIN', emailVerified: true },
  });
  console.log(`SUPER_ADMIN ready: ${email}`);
}

main().then(seedAdmin).finally(() => prisma.$disconnect());
