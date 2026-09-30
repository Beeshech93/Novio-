import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { COOKIE_NAME } from '../common/auth.guard';
import { Public, Tenant } from '../common/decorators';
import { TenantContext } from '../common/tenant';
import { ForgotDto, LoginDto, RegisterDto, ResetDto, TokenDto } from './auth.dto';
import { AuthService } from './auth.service';

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
  constructor(private auth: AuthService) {}

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
    const { token, ...rest } = await this.auth.login(dto);
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
}
