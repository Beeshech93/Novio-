import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { Public, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { verifyMetaSignature } from './providers';
import { NotificationsService } from './notifications.service';

const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

@ApiTags('notifications')
@Controller()
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get('notifications') async list(@Tenant() t: TenantContext) { return { items: await this.svc.list(t.businessId), unread: await this.svc.unreadCount(t.businessId) }; }
  @HttpCode(204) @Patch('notifications/:id/read') async read(@Tenant() t: TenantContext, @Param('id', ParseUUIDPipe) id: string) { await this.svc.markRead(t.businessId, id); }
  @HttpCode(204) @Post('notifications/read-all') async readAll(@Tenant() t: TenantContext) { await this.svc.markAllRead(t.businessId); }

  /** Called by a scheduler (Vercel Cron, GitHub Actions, uptime pinger...). Disabled unless CRON_SECRET is set. */
  @Public() @HttpCode(200) @Post('internal/cron/reminders')
  async cron(@Headers('x-cron-secret') secret?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new ForbiddenException('CRON_SECRET no configurado');
    if (!secret || !safeEq(secret, expected)) throw new UnauthorizedException();
    return this.svc.sendDueReminders();
  }

  /** Meta webhook handshake. */
  @Public() @Get('webhooks/whatsapp')
  verify(@Query('hub.mode') mode?: string, @Query('hub.verify_token') token?: string, @Query('hub.challenge') challenge?: string) {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!expected || mode !== 'subscribe' || !token || !safeEq(token, expected)) throw new ForbiddenException();
    return challenge ?? '';
  }

  /** Meta delivery/inbound events. Authenticated by X-Hub-Signature-256; currently acknowledged only. */
  @Public() @HttpCode(200) @Post('webhooks/whatsapp')
  inbound(@Req() req: { rawBody?: Buffer }, @Headers('x-hub-signature-256') sig?: string, @Body() _body?: unknown) {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) throw new ForbiddenException('WHATSAPP_APP_SECRET no configurado');
    verifyMetaSignature(req.rawBody ?? Buffer.alloc(0), sig, secret);
    return { received: true };
  }
}
