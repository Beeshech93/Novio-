import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignDto, CouponDto, SegmentDto, UpdateCouponDto } from './marketing.dto';

/** Customer filter shared by campaigns and automations. Always tenant-scoped. */
export function segmentWhere(businessId: string, seg: SegmentDto = {}, now = new Date()): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = [];
  if (seg.inactiveDays) and.push({ OR: [{ lastPurchaseAt: null }, { lastPurchaseAt: { lt: new Date(now.getTime() - seg.inactiveDays * 86_400_000) } }] });
  if (seg.tag) and.push({ tags: { some: { tag: seg.tag.toLowerCase() } } });
  if (seg.minSpent) and.push({ totalSpent: { gte: seg.minSpent } });
  return { businessId, deletedAt: null, AND: and };
}

@Injectable()
export class MarketingService {
  constructor(private prisma: PrismaService, private notifications?: NotificationsService) {}

  // ---- coupons ----
  listCoupons(businessId: string) { return this.prisma.coupon.findMany({ where: { businessId, deletedAt: null }, orderBy: { createdAt: 'desc' } }); }
  async createCoupon(businessId: string, dto: CouponDto) {
    if (dto.kind === 'PERCENT' && dto.value > 100) throw new BadRequestException('Un porcentaje no puede pasar de 100');
    try {
      return await this.prisma.coupon.create({ data: { ...dto, businessId, code: dto.code.toUpperCase(), startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined, endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Ya existe un cupón con ese código');
      throw e;
    }
  }
  async updateCoupon(businessId: string, id: string, dto: UpdateCouponDto) {
    const r = await this.prisma.coupon.updateMany({ where: { id, businessId, deletedAt: null }, data: { ...dto, endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined } });
    if (!r.count) throw new NotFoundException('Cupón no encontrado');
    return this.prisma.coupon.findFirstOrThrow({ where: { id, businessId } });
  }
  async removeCoupon(businessId: string, id: string) {
    const r = await this.prisma.coupon.updateMany({ where: { id, businessId, deletedAt: null }, data: { deletedAt: new Date(), active: false } });
    if (!r.count) throw new NotFoundException('Cupón no encontrado');
  }

  // ---- segments ----
  async previewSegment(businessId: string, seg: SegmentDto) {
    const where = segmentWhere(businessId, seg);
    const [total, reachable] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.count({ where: { ...where, marketingOptIn: true } }),
    ]);
    return { total, reachable }; // reachable = opted in to promotions
  }

  // ---- campaigns ----
  listCampaigns(businessId: string) { return this.prisma.campaign.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 100 }); }
  createCampaign(businessId: string, dto: CampaignDto) {
    return this.prisma.campaign.create({ data: { businessId, name: dto.name, channel: dto.channel, message: dto.message, segment: { ...(dto.segment ?? {}), subject: dto.subject } as Prisma.InputJsonValue } });
  }

  /** Sends to opted-in customers only (WhatsApp/email marketing consent). Claims the campaign first so it can't be sent twice. */
  async sendCampaign(businessId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, businessId } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    const claim = await this.prisma.campaign.updateMany({ where: { id, businessId, status: 'draft' }, data: { status: 'sending' } });
    if (!claim.count) throw new ConflictException('La campaña ya fue enviada o está en curso');
    if (!this.notifications) throw new BadRequestException('Mensajería no disponible');

    const business = await this.prisma.business.findFirstOrThrow({ where: { id: businessId } });
    const { subject, ...seg } = (campaign.segment ?? {}) as SegmentDto & { subject?: string };
    const customers = await this.prisma.customer.findMany({ where: { ...segmentWhere(businessId, seg), marketingOptIn: true }, take: 500 });

    let sent = 0, failed = 0;
    for (const c of customers) {
      const message = campaign.message.replace(/\{\{\s*customer\.name\s*\}\}/g, c.name).replace(/\{\{\s*business\.name\s*\}\}/g, business.name);
      const ok = campaign.channel === 'whatsapp'
        ? await this.notifications.sendWhatsApp(businessId, c.whatsapp ?? c.phone, 'campaign', { business: business.name, message })
        : await this.notifications.sendEmail(businessId, c.email, 'campaign', { business: business.name, subject: subject || campaign.name, message });
      ok ? sent++ : failed++;
    }
    return this.prisma.campaign.update({ where: { id }, data: { status: 'sent', sentCount: sent, failedCount: failed, sentAt: new Date() } });
  }
}
