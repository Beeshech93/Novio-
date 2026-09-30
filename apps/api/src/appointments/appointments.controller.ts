import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public, RequireFeature, RequirePermission, Roles, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import * as D from './appointments.dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('appointments')
@Controller()
export class AppointmentsController {
  constructor(private svc: AppointmentsService) {}

  // services
  @RequireFeature('appointments') @Get('services') services(@Tenant() t: TenantContext) { return this.svc.listServices(t.businessId); }
  @RequireFeature('appointments') @RequirePermission('services.write') @Post('services')
  createService(@Tenant() t: TenantContext, @Body() dto: D.ServiceDto) { return this.svc.createService(t.businessId, dto); }
  @RequireFeature('appointments') @RequirePermission('services.write') @Patch('services/:id')
  updateService(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: D.UpdateServiceDto) { return this.svc.updateService(t.businessId, id, dto); }
  @RequireFeature('appointments') @RequirePermission('services.write') @HttpCode(204) @Delete('services/:id')
  removeService(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.removeService(t.businessId, id); }

  // employees
  @RequireFeature('appointments') @Get('employees') employees(@Tenant() t: TenantContext) { return this.svc.listEmployees(t.businessId); }
  @RequireFeature('appointments') @Roles('OWNER', 'MANAGER') @Post('employees')
  createEmployee(@Tenant() t: TenantContext, @Body() dto: D.EmployeeDto) { return this.svc.createEmployee(t.businessId, dto); }
  @RequireFeature('appointments') @Roles('OWNER', 'MANAGER') @HttpCode(204) @Delete('employees/:id')
  removeEmployee(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.removeEmployee(t.businessId, id); }

  // hours / blocked days
  @RequireFeature('appointments') @Get('business-hours') hours(@Tenant() t: TenantContext) { return this.svc.getHours(t.businessId); }
  @RequireFeature('appointments') @Roles('OWNER', 'MANAGER') @Put('business-hours')
  setHours(@Tenant() t: TenantContext, @Body() dto: D.SetHoursDto) { return this.svc.setHours(t.businessId, dto.days); }
  @RequireFeature('appointments') @Get('blocked-dates') blocked(@Tenant() t: TenantContext) { return this.svc.listBlocked(t.businessId); }
  @RequireFeature('appointments') @Roles('OWNER', 'MANAGER') @Post('blocked-dates')
  block(@Tenant() t: TenantContext, @Body() dto: D.BlockDateDto) { return this.svc.block(t.businessId, dto); }
  @RequireFeature('appointments') @Roles('OWNER', 'MANAGER') @HttpCode(204) @Delete('blocked-dates/:id')
  unblock(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.unblock(t.businessId, id); }

  // appointments
  @RequireFeature('appointments') @Get('appointments/availability')
  availability(@Tenant() t: TenantContext, @Query() q: D.AvailabilityQuery) { return this.svc.availability(t.businessId, q); }
  @RequireFeature('appointments') @Get('appointments')
  list(@Tenant() t: TenantContext, @Query() q: D.ListAppointmentsQuery) { return this.svc.list(t.businessId, q); }
  @RequireFeature('appointments') @RequirePermission('appointments.write') @Post('appointments')
  create(@Tenant() t: TenantContext, @Body() dto: D.CreateAppointmentDto) { return this.svc.create(t.businessId, dto); }
  @RequireFeature('appointments') @RequirePermission('appointments.write') @Patch('appointments/:id/reschedule')
  reschedule(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: D.RescheduleDto) { return this.svc.reschedule(t.businessId, id, dto); }
  @RequireFeature('appointments') @RequirePermission('appointments.write') @Patch('appointments/:id/status')
  status(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: D.AppointmentStatusDto) { return this.svc.setStatus(t.businessId, id, dto.status); }

  // public booking (no auth; abuse-limited)
  @Public() @Get('public/sites/:host/availability')
  pubAvail(@Param('host') host: string, @Query() q: D.AvailabilityQuery) { return this.svc.publicAvailability(host, q); }
  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @Post('public/sites/:host/appointments')
  pubBook(@Param('host') host: string, @Body() dto: D.PublicBookingDto) { return this.svc.publicBook(host, dto); }
}
