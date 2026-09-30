import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/** Prices come from the database — never hardcode them in the frontend. */
@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.plan.findMany({ where: { active: true }, orderBy: [{ price: 'asc' }] });
  }
}
