import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TEMPLATES } from './templates';
import { UpdateWebsiteDto } from './websites.dto';

const RESERVED = new Set(['www', 'app', 'admin', 'api', 'mail', 'static', 'assets', 'docs', 'nuvio', 'support', 'soporte']);

@Injectable()
export class WebsitesService {
  constructor(private prisma: PrismaService) {}

  templates() { return TEMPLATES; }

  async get(businessId: string) {
    const site = await this.prisma.website.findUnique({ where: { businessId }, include: { template: true } });
    if (!site) throw new NotFoundException('Sitio no encontrado');
    return site;
  }

  async update(businessId: string, dto: UpdateWebsiteDto) {
    const current = await this.get(businessId);
    if (dto.subdomain && RESERVED.has(dto.subdomain)) throw new BadRequestException('Ese subdominio está reservado');

    let templateId: string | undefined;
    if (dto.templateSlug) {
      const t = TEMPLATES.find((x) => x.slug === dto.templateSlug)!;
      const row = await this.prisma.websiteTemplate.upsert({
        where: { slug: t.slug }, update: {}, create: { slug: t.slug, name: t.name, category: t.category, config: t as unknown as Prisma.InputJsonValue },
      });
      templateId = row.id;
    }
    try {
      return await this.prisma.website.update({
        where: { businessId },
        data: {
          ...(dto.subdomain && { subdomain: dto.subdomain }),
          ...(templateId && { templateId }),
          ...(dto.published !== undefined && { published: dto.published }),
          // Merge so a partial edit doesn't wipe the rest of the content.
          ...(dto.content && { content: { ...(current.content as object), ...JSON.parse(JSON.stringify(dto.content)) } }),
        },
        include: { template: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Ese subdominio ya está en uso');
      throw e;
    }
  }

  /**
   * Public read by host label (subdomain) or full custom domain. Returns ONLY published sites
   * and only fields meant for visitors (no ids of other tenants, no contact data beyond what the owner published).
   */
  async publicSite(host: string) {
    const key = host.toLowerCase().trim();
    const site = await this.prisma.website.findFirst({
      where: { published: true, business: { deletedAt: null, status: 'ACTIVE' }, OR: [{ subdomain: key }, { customDomain: key }] },
      include: { template: true, business: true },
    });
    if (!site) throw new NotFoundException();
    const b = site.business;
    const [products, services] = await Promise.all([
      this.prisma.product.findMany({ where: { businessId: b.id, deletedAt: null, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 48,
        select: { id: true, name: true, description: true, price: true, compareAtPrice: true, imageUrl: true } }),
      this.prisma.service.findMany({ where: { businessId: b.id, deletedAt: null, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 48,
        select: { id: true, name: true, description: true, price: true, durationMin: true, imageUrl: true } }),
    ]);
    return {
      name: b.name, category: b.category, city: b.city,
      templateSlug: site.template?.slug ?? TEMPLATES.find((t) => t.category === b.category)?.slug ?? 'servicios',
      content: site.content, products, services,
    };
  }
}
