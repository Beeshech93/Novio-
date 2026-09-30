import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Public, RequirePermission, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { PaymentsService } from './payments.service';

class CreatePaymentDto {
  @IsUUID() orderId: string;
  @IsEnum(['CARD', 'TRANSFER', 'PAYMENT_LINK', 'CHECKOUT', 'IN_STORE']) method: any;
}
class ListPaymentsQuery { @IsOptional() @IsUUID() orderId?: string }

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @Get('payments') list(@Tenant() t: TenantContext, @Query() q: ListPaymentsQuery) { return this.svc.list(t.businessId, q.orderId); }

  @RequirePermission('payments.write') @Post('payments')
  create(@Tenant() t: TenantContext, @Body() dto: CreatePaymentDto) { return this.svc.create(t.businessId, dto.orderId, dto.method); }

  @RequirePermission('payments.write') @HttpCode(200) @Post('payments/:id/confirm')
  confirm(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.confirmManual(t.businessId, id); }

  /** Public on purpose: authenticated by provider signature over the raw body. */
  @Public() @HttpCode(200) @Post('webhooks/payments/:provider')
  webhook(@Param('provider') provider: string, @Req() req: { rawBody?: Buffer }, @Headers('x-nuvio-signature') sig?: string) {
    return this.svc.handleWebhook(provider, req.rawBody ?? Buffer.alloc(0), sig);
  }
}
