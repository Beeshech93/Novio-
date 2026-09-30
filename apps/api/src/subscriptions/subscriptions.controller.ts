import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsString, MaxLength } from 'class-validator';
import { Public, Roles, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { SubscriptionsService } from './subscriptions.service';

class CheckoutDto { @IsString() @MaxLength(40) planSlug: string; @IsEnum(['MONTHLY', 'YEARLY']) interval: 'MONTHLY' | 'YEARLY' }
class CancelDto { @IsBoolean() cancel: boolean }

@ApiTags('subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(private svc: SubscriptionsService) {}

  @Get('subscriptions') async current(@Tenant() t: TenantContext) {
    return { subscription: await this.svc.current(t.businessId), features: await this.svc.features(t.businessId) };
  }

  @Roles('OWNER') @Post('subscriptions/checkout')
  checkout(@Tenant() t: TenantContext, @Body() dto: CheckoutDto) { return this.svc.startCheckout(t.businessId, dto.planSlug, dto.interval); }

  @Roles('OWNER') @HttpCode(200) @Post('subscriptions/cancel')
  cancel(@Tenant() t: TenantContext, @Body() dto: CancelDto) { return this.svc.setCancelAtPeriodEnd(t.businessId, dto.cancel); }

  /** Public on purpose: authenticated by provider signature over the raw body. */
  @Public() @HttpCode(200) @Post('webhooks/billing/:provider')
  webhook(@Param('provider') provider: string, @Req() req: { rawBody?: Buffer }, @Headers('x-nuvio-signature') sig?: string) {
    return this.svc.handleWebhook(provider, req.rawBody ?? Buffer.alloc(0), sig);
  }
}
