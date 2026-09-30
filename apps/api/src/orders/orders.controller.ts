import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermission, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { CreateOrderDto, ListOrdersQuery, UpdateStatusDto } from './orders.dto';
import { OrdersService } from './orders.service';

@RequireFeature('orders')
@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private svc: OrdersService) {}

  @Get() list(@Tenant() t: TenantContext, @Query() q: ListOrdersQuery) { return this.svc.list(t.businessId, q); }
  @Get(':id') get(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(t.businessId, id); }

  @RequirePermission('orders.write') @Post()
  create(@Tenant() t: TenantContext, @Body() dto: CreateOrderDto) { return this.svc.create(t.businessId, dto); }
  @RequirePermission('orders.write') @Patch(':id/status')
  status(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatusDto) { return this.svc.setStatus(t.businessId, id, dto.status); }
}
