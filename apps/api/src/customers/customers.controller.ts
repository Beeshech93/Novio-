import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermission, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { CustomerDto, ListCustomersQuery, UpdateCustomerDto } from './customers.dto';
import { CustomersService } from './customers.service';

@RequireFeature('customers')
@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private svc: CustomersService) {}

  @Get() list(@Tenant() t: TenantContext, @Query() q: ListCustomersQuery) { return this.svc.list(t.businessId, q); }
  @Get(':id') get(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(t.businessId, id); }
  @Get(':id/history') history(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.history(t.businessId, id); }

  @RequirePermission('customers.write') @Post()
  create(@Tenant() t: TenantContext, @Body() dto: CustomerDto) { return this.svc.create(t.businessId, dto); }
  @RequirePermission('customers.write') @Patch(':id')
  update(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) { return this.svc.update(t.businessId, id, dto); }
  @RequirePermission('customers.write') @HttpCode(204) @Delete(':id')
  remove(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(t.businessId, id); }
}
