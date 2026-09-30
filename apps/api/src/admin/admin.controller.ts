import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PlatformAdmin } from '../common/decorators';
import { toCents } from '../orders/order-logic';
import { PrismaService } from '../prisma/prisma.service';
import { FEATURES, monthlyCents } from '../subscriptions/access';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

class PlanDto {
  @IsString() @MaxLength(60) name: string;
  @IsString() @MaxLength(40) slug: string;
  @IsEnum(['MONTHLY', 'YEARLY']) billingInterval: 'MONTHLY' | 'YEARLY';
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsArray() @ArrayMaxSize(30) @IsEnum(FEATURES, { each: true }) features: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
class UpdatePlanDto {
  @IsOptional() @IsString() @MaxLength(60) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsEnum(FEATURES, { each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
class AssignDto {
  @IsString() @MaxLength(40) planSlug: string;
  @IsEnum(['MONTHLY', 'YEARLY']) interval: 'MONTHLY' | 'YEARLY';
  @IsOptional() @IsEnum(['active', 'trialing']) status?: 'active' | 'trialing';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) days?: number;
}
class StatusDto { @IsEnum(['ACTIVE', 'SUSPENDED']) status: 'ACTIVE' | 'SUSPENDED' }
class PageQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

/** Platform administration. Only users with platformRole SUPER_ADMIN pass the guard. */
@ApiTags('admin')
@PlatformAdmin()
@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService, private subs: SubscriptionsService) {}

  @Get('metrics')
  async metrics() {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
    const [live, cancelled30, cancelledTotal, newBusinesses, totalBusinesses, trialing] = await Promise.all([
      this.prisma.subscription.findMany({ where: { status: 'active', OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] }, include: { plan: true } }),
      this.prisma.subscription.count({ where: { status: 'cancelled', updatedAt: { gte: monthAgo }, provider: { not: 'trial' } } }),
      this.prisma.subscription.count({ where: { status: 'cancelled', provider: { not: 'trial' } } }),
      this.prisma.business.count({ where: { createdAt: { gte: monthAgo }, deletedAt: null } }),
      this.prisma.business.count({ where: { deletedAt: null } }),
      this.prisma.subscription.count({ where: { status: 'trialing', currentPeriodEnd: { gt: now } } }),
    ]);
    const mrrCents = live.reduce((s, x) => s + monthlyCents(toCents(x.plan.price), x.billingInterval), 0);
    const paying = live.length;
    const churnBase = paying + cancelled30;
    return {
      mrr: mrrCents / 100, arr: (mrrCents * 12) / 100, activeSubscriptions: paying, trialing,
      arpu: paying ? mrrCents / paying / 100 : 0,
      churn30d: churnBase ? cancelled30 / churnBase : 0,
      cancelledSubscriptions: cancelledTotal, newBusinesses30d: newBusinesses, totalBusinesses,
      conversion: totalBusinesses ? paying / totalBusinesses : 0,
    };
  }

  @Get('businesses')
  async businesses(@Query() q: PageQuery) {
    const page = q.page ?? 1;
    const where = { deletedAt: null, ...(q.q && { name: { contains: q.q, mode: 'insensitive' as const } }) };
    const [items, total] = await Promise.all([
      this.prisma.business.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 25, take: 25,
        include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } }, members: { where: { role: 'OWNER' }, include: { user: { select: { name: true, email: true } } } } } }),
      this.prisma.business.count({ where }),
    ]);
    return { items, total, page, pageSize: 25 };
  }

  @Patch('businesses/:id/status')
  async setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) {
    const res = await this.prisma.business.update({ where: { id }, data: { status: dto.status } });
    await this.prisma.auditLog.create({ data: { businessId: id, action: `admin.business.${dto.status.toLowerCase()}`, entity: 'business', entityId: id } });
    return res;
  }

  @Post('businesses/:id/subscription')
  async assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto) {
    const sub = await this.subs.assign(id, dto.planSlug, dto.interval, { status: dto.status, days: dto.days });
    await this.prisma.auditLog.create({ data: { businessId: id, action: 'admin.subscription.assigned', entity: 'subscription', entityId: sub.id, metadata: { plan: dto.planSlug, interval: dto.interval } } });
    return sub;
  }

  @Get('plans') plans() { return this.prisma.plan.findMany({ orderBy: [{ slug: 'asc' }, { billingInterval: 'asc' }] }); }

  @Post('plans')
  createPlan(@Body() dto: PlanDto) {
    return this.prisma.plan.create({ data: { ...dto, currency: dto.currency ?? 'MXN', features: dto.features } });
  }

  @Patch('plans/:id')
  async updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.update({ where: { id }, data: dto });
    await this.prisma.auditLog.create({ data: { action: 'admin.plan.updated', entity: 'plan', entityId: id, metadata: dto as object } });
    return plan;
  }
}
