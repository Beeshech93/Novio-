import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, RequireFeature, Roles, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { UpdateWebsiteDto } from './websites.dto';
import { WebsitesService } from './websites.service';

@ApiTags('website')
@Controller()
export class WebsitesController {
  constructor(private svc: WebsitesService) {}

  @RequireFeature('website') @Get('website') get(@Tenant() t: TenantContext) { return this.svc.get(t.businessId); }
  @RequireFeature('website') @Get('website/templates') templates() { return this.svc.templates(); }
  @RequireFeature('website') @Roles('OWNER', 'MANAGER') @Patch('website')
  update(@Tenant() t: TenantContext, @Body() dto: UpdateWebsiteDto) { return this.svc.update(t.businessId, dto); }

  /** Visitor-facing: no auth. Host is a subdomain label or a custom domain. */
  @Public() @Get('public/sites/:host')
  publicSite(@Param('host') host: string) { return this.svc.publicSite(host); }
}
