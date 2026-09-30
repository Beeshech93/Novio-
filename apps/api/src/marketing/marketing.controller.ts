import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { AutomationsService } from '../automations/automations.service';
import { RequireFeature, Roles, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { AutomationDto, CampaignDto, CouponDto, SegmentDto, UpdateCouponDto } from './marketing.dto';
import { MarketingService } from './marketing.service';

class ActiveDto { @IsBoolean() active: boolean }

@ApiTags('marketing')
@Roles('OWNER', 'MANAGER')
@Controller()
export class MarketingController {
  constructor(private svc: MarketingService, private autos: AutomationsService) {}

  @RequireFeature('marketing') @Get('coupons') coupons(@Tenant() t: TenantContext) { return this.svc.listCoupons(t.businessId); }
  @RequireFeature('marketing') @Post('coupons') createCoupon(@Tenant() t: TenantContext, @Body() d: CouponDto) { return this.svc.createCoupon(t.businessId, d); }
  @RequireFeature('marketing') @Patch('coupons/:id') updateCoupon(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateCouponDto) { return this.svc.updateCoupon(t.businessId, id, d); }
  @RequireFeature('marketing') @HttpCode(204) @Delete('coupons/:id') removeCoupon(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.removeCoupon(t.businessId, id); }

  @RequireFeature('marketing') @HttpCode(200) @Post('segments/preview') preview(@Tenant() t: TenantContext, @Body() d: SegmentDto) { return this.svc.previewSegment(t.businessId, d); }

  @RequireFeature('marketing') @Get('campaigns') campaigns(@Tenant() t: TenantContext) { return this.svc.listCampaigns(t.businessId); }
  @RequireFeature('marketing') @Post('campaigns') createCampaign(@Tenant() t: TenantContext, @Body() d: CampaignDto) { return this.svc.createCampaign(t.businessId, d); }
  @RequireFeature('marketing') @HttpCode(200) @Post('campaigns/:id/send') send(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.sendCampaign(t.businessId, id); }

  @RequireFeature('automation') @Get('automations') autoList(@Tenant() t: TenantContext) { return this.autos.list(t.businessId); }
  @RequireFeature('automation') @Post('automations') autoCreate(@Tenant() t: TenantContext, @Body() d: AutomationDto) { return this.autos.create(t.businessId, d); }
  @RequireFeature('automation') @HttpCode(204) @Put('automations/:id/active') async autoActive(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() d: ActiveDto) { await this.autos.setActive(t.businessId, id, d.active); }
  @RequireFeature('automation') @HttpCode(204) @Delete('automations/:id') autoRemove(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.autos.remove(t.businessId, id); }
}
