import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { RequireFeature, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { AnalyticsService } from './analytics.service';

class RangeQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}
  @RequireFeature('analytics') @Get('overview') overview(@Tenant() t: TenantContext, @Query() q: RangeQuery) { return this.svc.overview(t.businessId, q.from, q.to); }
}
