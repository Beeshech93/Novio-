import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/** Liveness (`/health`) never touches the DB; readiness (`/health/ready`) checks it. Used by Docker/Render/uptime monitors. */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public() @Get() live() { return { status: 'ok' }; }

  @Public() @Get('ready')
  async ready() {
    try { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ok', db: 'up' }; }
    catch { throw new ServiceUnavailableException({ status: 'error', db: 'down' }); }
  }
}
