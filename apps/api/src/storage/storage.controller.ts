import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsString } from 'class-validator';
import { Roles, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { Purpose, PURPOSES, StorageService } from './storage.service';

class PresignDto {
  @IsIn([...PURPOSES]) purpose: Purpose;
  @IsString() contentType: string;
}

@ApiTags('uploads')
@Roles('OWNER', 'MANAGER')
@Controller('uploads')
export class StorageController {
  constructor(private svc: StorageService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } }) @HttpCode(200) @Post('presign')
  presign(@Tenant() t: TenantContext, @Body() d: PresignDto) { return this.svc.presign(t.businessId, d.purpose, d.contentType); }
}
