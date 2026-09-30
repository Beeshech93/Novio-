import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { PrismaService } from '../prisma/prisma.service';

class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsEmail() email?: string;
}

@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@Tenant() t: TenantContext) {
    return this.prisma.business.findMany({
      where: { deletedAt: null, members: { some: { userId: t.userId } } },
    });
  }

  @Get('current')
  current(@Tenant() t: TenantContext) {
    return this.prisma.business.findFirstOrThrow({ where: { id: t.businessId, deletedAt: null } });
  }

  @Roles('OWNER', 'MANAGER')
  @Patch('current')
  async update(@Tenant() t: TenantContext, @Body() dto: UpdateBusinessDto) {
    const business = await this.prisma.business.update({ where: { id: t.businessId }, data: dto });
    await this.prisma.auditLog.create({
      data: { businessId: t.businessId, userId: t.userId, action: 'business.updated', entity: 'business', entityId: t.businessId },
    });
    return business;
  }
}
