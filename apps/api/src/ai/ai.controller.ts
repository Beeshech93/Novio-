import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RequireFeature, Roles, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { AiService } from './ai.service';
import { Task, TASKS } from './ai.logic';

class GenerateDto {
  @IsEnum(Object.keys(TASKS)) task: Task;
  @IsString() @MinLength(3) @MaxLength(1500) prompt: string;
  @IsOptional() @IsString() @MaxLength(40) tone?: string;
}

@ApiTags('ai')
@Roles('OWNER', 'MANAGER')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('ai')
export class AiController {
  constructor(private svc: AiService) {}
  @RequireFeature('marketing') @HttpCode(200) @Post('generate')
  generate(@Tenant() t: TenantContext, @Body() d: GenerateDto) { return this.svc.generate(t.businessId, t.userId, d.task, d.prompt, d.tone); }
  @RequireFeature('analytics') @HttpCode(200) @Post('insights')
  insights(@Tenant() t: TenantContext) { return this.svc.insights(t.businessId, t.userId); }
}
