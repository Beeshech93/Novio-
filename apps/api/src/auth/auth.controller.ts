import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { COOKIE_NAME } from '../common/auth.guard';
import { Public, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { CodeDto, DisableTwoFaDto, ForgotDto, LoginDto, TwoFaLoginDto, RegisterDto, ResetDto, TokenDto } from './auth.dto';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 3600 * 1000,
  path: '/',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private twoFactor: TwoFactorService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { token, ...rest } = await this.auth.register(dto);
    res.cookie(COOKIE_NAME, token, cookieOpts);
    return { ...rest, token };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    if (result.twoFactorRequired) return result; // no session yet: the client must call /auth/2fa/login
    const { twoFactorRequired: _t, token, ...rest } = result;
    res.cookie(COOKIE_NAME, token, cookieOpts);
    return { ...rest, token };
  }

  @HttpCode(204)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
  }

  @Get('me')
  me(@Tenant() t: TenantContext) {
    return this.auth.me(t.userId);
  }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(204) @Post('verify-email')
  async verifyEmail(@Body() dto: TokenDto) { await this.auth.verifyEmail(dto.token); }

  @Throttle({ default: { limit: 3, ttl: 60_000 } }) @HttpCode(204) @Post('verify-email/resend')
  async resend(@Tenant() t: TenantContext) { await this.auth.resendVerification(t.userId); }

  @Public() @Throttle({ default: { limit: 3, ttl: 60_000 } }) @HttpCode(204) @Post('forgot-password')
  async forgot(@Body() dto: ForgotDto) { await this.auth.forgotPassword(dto.email); }

  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(204) @Post('reset-password')
  async reset(@Body() dto: ResetDto) { await this.auth.resetPassword(dto.token, dto.password); }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post('2fa/login')
  async twoFaLogin(@Body() dto: TwoFaLoginDto, @Res({ passthrough: true }) res: Response) {
    const userId = await this.twoFactor.completeLogin(dto.challenge, dto.code);
    const { token, user } = await this.auth.sessionFor(userId);
    res.cookie(COOKIE_NAME, token, cookieOpts);
    return { user, token };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(200) @Post('2fa/setup')
  setup(@Tenant() t: TenantContext) { return this.twoFactor.setup(t.userId); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post('2fa/enable')
  enable(@Tenant() t: TenantContext, @Body() dto: CodeDto) { return this.twoFactor.enable(t.userId, dto.code); }

  @Throttle({ default: { limit: 5, ttl: 60_000 } }) @HttpCode(204) @Post('2fa/disable')
  async disable(@Tenant() t: TenantContext, @Body() dto: DisableTwoFaDto) { await this.twoFactor.disable(t.userId, dto.password, dto.code); }
}
