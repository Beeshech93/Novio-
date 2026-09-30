import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AutomationDto } from '../marketing/marketing.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { Condition, conditionsMatch, renderText } from './automation-logic';

@Injectable()
export class AutomationsService {
  private log = new Logger('Automations');
  constructor(private prisma: PrismaService, private notifications?: NotificationsService) {}

  list(businessId: string) { return this.prisma.automation.findMany({ where: { businessId }, include: { triggers: true, actions: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } }); }

  create(businessId: string, dto: AutomationDto) {
    if (dto.actions.length === 0 || dto.actions.length > 5) throw new BadRequestException('Una automatización necesita entre 1 y 5 acciones');
    if (dto.trigger === 'customer.inactive' && !dto.inactiveDays) throw new BadRequestException('Indica los días de inactividad');
    return this.prisma.automation.create({
      data: {
        businessId, name: dto.name,
        triggers: { create: { businessId, type: dto.trigger, condition: { conditions: dto.conditions ?? [], inactiveDays: dto.inactiveDays } as unknown as Prisma.InputJsonValue } },
        actions: { create: dto.actions.map((a, i) => ({ businessId, type: a.type, position: i, config: { message: a.message, title: a.title, tag: a.tag } as Prisma.InputJsonValue })) },
      },
      include: { triggers: true, actions: true },
    });
  }

  async setActive(businessId: string, id: string, active: boolean) {
    const r = await this.prisma.automation.updateMany({ where: { id, businessId }, data: { active } });
    if (!r.count) throw new NotFoundException();
  }
  async remove(businessId: string, id: string) {
    const r = await this.prisma.automation.deleteMany({ where: { id, businessId } });
    if (!r.count) throw new NotFoundException();
  }

  /**
   * Event entry point. `entityKey` makes a run idempotent per (automation, entity):
   * the same order/payment can't trigger the same automation twice. Never throws.
   */
  async fire(businessId: string, trigger: string, entityKey: string, context: { customerId?: string | null } & Record<string, unknown>) {
    try {
      const automations = await this.prisma.automation.findMany({ where: { businessId, active: true, triggers: { some: { type: trigger } } }, include: { triggers: true, actions: { orderBy: { position: 'asc' } } } });
      if (!automations.length) return 0;
      const [business, customer] = await Promise.all([
        this.prisma.business.findFirstOrThrow({ where: { id: businessId } }),
        context.customerId ? this.prisma.customer.findFirst({ where: { id: context.customerId, businessId, deletedAt: null }, include: { tags: true } }) : null,
      ]);
      const ctx = { ...context, business, customer: customer && { ...customer, tags: customer.tags.map((t) => t.tag).join(',') } };
      let ran = 0;
      for (const a of automations) {
        const conds = ((a.triggers[0]?.condition ?? {}) as { conditions?: Condition[] }).conditions;
        if (!conditionsMatch(conds, ctx)) continue;
        try { await this.prisma.automationRun.create({ data: { businessId, automationId: a.id, entityKey } }); }
        catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; throw e; }
        for (const action of a.actions) await this.execute(businessId, action.type, (action.config ?? {}) as Record<string, string>, ctx);
        ran++;
      }
      return ran;
    } catch (e) {
      this.log.warn(`automation ${trigger} failed: ${(e as Error).message}`);
      return 0;
    }
  }

  /** Time-based trigger: customers with no purchases for N days. Run from the scheduler. */
  async runInactiveCustomers(now = new Date()) {
    const automations = await this.prisma.automation.findMany({ where: { active: true, triggers: { some: { type: 'customer.inactive' } } }, include: { triggers: true } });
    const month = now.toISOString().slice(0, 7);
    let fired = 0;
    for (const a of automations) {
      const days = ((a.triggers[0]?.condition ?? {}) as { inactiveDays?: number }).inactiveDays;
      if (!days) continue;
      const cutoff = new Date(now.getTime() - days * 86_400_000);
      const customers = await this.prisma.customer.findMany({
        where: { businessId: a.businessId, deletedAt: null, lastPurchaseAt: { lt: cutoff, not: null } }, take: 200, select: { id: true },
      });
      // Once per customer per month, so a long-inactive customer isn't messaged every cron tick.
      for (const c of customers) fired += await this.fire(a.businessId, 'customer.inactive', `${a.id}:${c.id}:${month}`, { customerId: c.id });
    }
    return { fired };
  }

  private async execute(businessId: string, type: string, cfg: Record<string, string>, ctx: any) {
    const text = renderText(cfg.message ?? '', ctx);
    switch (type) {
      case 'internal_notification':
        return this.notifications?.internal(businessId, 'automation', cfg.title ? renderText(cfg.title, ctx) : 'Automatización', text);
      case 'tag_customer':
        if (ctx.customer && cfg.tag) await this.prisma.customerTag.upsert({ where: { customerId_tag: { customerId: ctx.customer.id, tag: cfg.tag.toLowerCase() } }, update: {}, create: { businessId, customerId: ctx.customer.id, tag: cfg.tag.toLowerCase() } });
        return;
      case 'send_whatsapp':
        // Promotional content requires the customer's opt-in.
        if (ctx.customer?.marketingOptIn) await this.notifications?.sendWhatsApp(businessId, ctx.customer.whatsapp ?? ctx.customer.phone, 'campaign', { business: ctx.business.name, message: text });
        return;
      case 'send_email':
        if (ctx.customer?.marketingOptIn) await this.notifications?.sendEmail(businessId, ctx.customer.email, 'campaign', { business: ctx.business.name, subject: cfg.title ? renderText(cfg.title, ctx) : ctx.business.name, message: text });
        return;
    }
  }
}
