import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermission, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { CategoryDto, ImportCsvDto, ListProductsQuery, ProductDto, UpdateProductDto } from './products.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(private svc: ProductsService) {}

  @Get('products') list(@Tenant() t: TenantContext, @Query() q: ListProductsQuery) { return this.svc.list(t.businessId, q); }
  @Get('products/low-stock') low(@Tenant() t: TenantContext) { return this.svc.lowStock(t.businessId); }
  @Get('products/export') @Header('Content-Type', 'text/csv; charset=utf-8')
  @RequirePermission('products.read') export(@Tenant() t: TenantContext) { return this.svc.exportCsv(t.businessId); }
  @Get('products/:id') get(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(t.businessId, id); }

  @RequirePermission('products.write') @Post('products')
  create(@Tenant() t: TenantContext, @Body() dto: ProductDto) { return this.svc.create(t.businessId, dto); }
  @RequirePermission('products.write') @HttpCode(200) @Post('products/import')
  import(@Tenant() t: TenantContext, @Body() dto: ImportCsvDto) { return this.svc.importCsv(t.businessId, dto.csv); }
  @RequirePermission('products.write') @Post('products/:id/duplicate')
  duplicate(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.duplicate(t.businessId, id); }
  @RequirePermission('products.write') @Patch('products/:id')
  update(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) { return this.svc.update(t.businessId, id, dto); }
  @RequirePermission('products.write') @HttpCode(204) @Delete('products/:id')
  remove(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(t.businessId, id); }

  @Get('product-categories') categories(@Tenant() t: TenantContext) { return this.svc.categories(t.businessId); }
  @RequirePermission('products.write') @Post('product-categories')
  createCategory(@Tenant() t: TenantContext, @Body() dto: CategoryDto) { return this.svc.createCategory(t.businessId, dto.name); }
  @RequirePermission('products.write') @HttpCode(204) @Delete('product-categories/:id')
  removeCategory(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.removeCategory(t.businessId, id); }
}
