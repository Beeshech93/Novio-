import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SiteContentDto, UpdateWebsiteDto } from './websites.dto';
import { WebsitesService } from './websites.service';

describe('WebsitesService', () => {
  const prisma: any = {
    website: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    websiteTemplate: { upsert: jest.fn() },
    product: { findMany: jest.fn().mockResolvedValue([]) }, service: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const svc = new WebsitesService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('blocks reserved subdomains', async () => {
    prisma.website.findUnique.mockResolvedValue({ content: {} });
    await expect(svc.update('b1', { subdomain: 'admin' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('merges content instead of replacing it', async () => {
    prisma.website.findUnique.mockResolvedValue({ content: { title: 'Old', tagline: 'keep' } });
    await svc.update('b1', { content: { title: 'New' } as any });
    expect(prisma.website.update.mock.calls[0][0].data.content).toEqual({ title: 'New', tagline: 'keep' });
  });

  it('public lookup only returns published sites of active businesses', async () => {
    prisma.website.findFirst.mockResolvedValue(null);
    await expect(svc.publicSite('Mi-Barberia')).rejects.toBeInstanceOf(NotFoundException);
    const where = prisma.website.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ published: true, business: { deletedAt: null, status: 'ACTIVE' } });
    expect(JSON.stringify(where.OR)).toContain('mi-barberia');
  });

  it('public lookup never selects tenant-internal fields for products', async () => {
    prisma.website.findFirst.mockResolvedValue({ business: { id: 'b1', name: 'X', category: 'tienda', city: null }, template: null, content: {} });
    await svc.publicSite('x');
    expect(prisma.product.findMany.mock.calls[0][0].select).not.toHaveProperty('cost');
    expect(prisma.product.findMany.mock.calls[0][0].where).toMatchObject({ businessId: 'b1', status: 'ACTIVE' });
  });
});

describe('site content validation', () => {
  it('rejects javascript: URLs, bad colors and non-Google map links', async () => {
    const bad = plainToInstance(SiteContentDto, { logoUrl: 'javascript:alert(1)', primaryColor: 'red', mapsUrl: 'https://evil.example/x', photos: ['data:text/html,x'] });
    const errs = (await validate(bad)).map((e) => e.property).sort();
    expect(errs).toEqual(['logoUrl', 'mapsUrl', 'photos', 'primaryColor']);
  });
  it('accepts valid content and subdomain', async () => {
    const ok = plainToInstance(UpdateWebsiteDto, { subdomain: 'mi-barberia', templateSlug: 'barberia', content: { logoUrl: 'https://cdn.x.com/a.png', primaryColor: '#111827', whatsapp: '+5215512345678' } });
    expect(await validate(ok)).toHaveLength(0);
    expect((await validate(plainToInstance(UpdateWebsiteDto, { subdomain: '-bad-' }))).length).toBe(1);
  });
});
