import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt, encrypt, newSecret, otpauthUri, twoFaConfigured, verifyTotp } from './totp';

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const normalizeRecovery = (c: string) => c.trim().toLowerCase();

@Injectable()
export class TwoFactorService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private requireConfigured() {
    if (!twoFaConfigured()) throw new ServiceUnavailableException('La verificación en dos pasos no está configurada en el servidor');
  }

  /** Short-lived token proving the password step passed. It carries `purpose: '2fa'`, which AuthGuard refuses as a session. */
  challenge(userId: string) { return this.jwt.signAsync({ sub: userId, purpose: '2fa' }, { expiresIn: '5m' }); }

  async setup(userId: string) {
    this.requireConfigured();
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    if (user.totpEnabled) throw new ConflictException('La verificación en dos pasos ya está activa');
    const secret = newSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: encrypt(secret) } });
    const uri = otpauthUri(secret, user.email);
    return { secret, otpauthUri: uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }

  async enable(userId: string, code: string) {
    this.requireConfigured();
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    if (user.totpEnabled) throw new ConflictException('Ya está activa');
    if (!user.totpSecretEnc) throw new BadRequestException('Primero genera el código QR');
    const step = verifyTotp(decrypt(user.totpSecretEnc), code);
    if (step === null) throw new BadRequestException('Código incorrecto');
    const codes = Array.from({ length: 10 }, () => `${randomBytes(2).toString('hex')}-${randomBytes(2).toString('hex')}`);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true, totpLastStep: step, recoveryCodes: codes.map(sha), twoFaFailures: 0 } }),
      this.prisma.auditLog.create({ data: { userId, action: 'auth.2fa_enabled' } }),
    ]);
    return { recoveryCodes: codes }; // shown once; only hashes are stored
  }

  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    if (!user.totpEnabled) return;
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Contraseña incorrecta');
    await this.checkSecondFactor(user, code);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecretEnc: null, totpLastStep: null, recoveryCodes: [], twoFaFailures: 0, twoFaLockedUntil: null } }),
      this.prisma.auditLog.create({ data: { userId, action: 'auth.2fa_disabled' } }),
    ]);
  }

  /** Second login step. Returns the user id on success; the caller issues the session. */
  async completeLogin(challenge: string, code: string) {
    let payload: { sub: string; purpose?: string };
    try { payload = await this.jwt.verifyAsync(challenge); } catch { throw new UnauthorizedException('La sesión de verificación expiró, inicia sesión de nuevo'); }
    if (payload.purpose !== '2fa') throw new UnauthorizedException();
    const user = await this.prisma.user.findFirst({ where: { id: payload.sub, deletedAt: null } });
    if (!user || !user.totpEnabled) throw new UnauthorizedException();
    await this.checkSecondFactor(user, code);
    return user.id;
  }

  /** Accepts a TOTP code or a one-time recovery code. Brute force is limited by a lockout (5 failures -> 15 min). */
  private async checkSecondFactor(user: { id: string; totpSecretEnc: string | null; totpLastStep: number | null; recoveryCodes: string[]; twoFaLockedUntil: Date | null }, code: string) {
    if (user.twoFaLockedUntil && user.twoFaLockedUntil > new Date()) throw new HttpException('Demasiados intentos. Intenta de nuevo en unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
    const clean = code.trim();

    const step = user.totpSecretEnc ? verifyTotp(decrypt(user.totpSecretEnc), clean, Date.now(), user.totpLastStep) : null;
    if (step !== null) {
      // Guarded write: only advance if nobody else consumed this step first (blocks parallel replay).
      const claim = await this.prisma.user.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step, twoFaFailures: 0, twoFaLockedUntil: null } });
      if (claim.count === 1) return;
    } else {
      const hash = sha(normalizeRecovery(clean));
      if (user.recoveryCodes.includes(hash)) {
        const remaining = user.recoveryCodes.filter((h) => h !== hash);
        const claim = await this.prisma.user.updateMany({ where: { id: user.id, recoveryCodes: { has: hash } }, data: { recoveryCodes: remaining, twoFaFailures: 0, twoFaLockedUntil: null } });
        if (claim.count === 1) return;
      }
    }
    const failed = await this.prisma.user.update({ where: { id: user.id }, data: { twoFaFailures: { increment: 1 } } });
    if (failed.twoFaFailures >= MAX_FAILURES) await this.prisma.user.update({ where: { id: user.id }, data: { twoFaLockedUntil: new Date(Date.now() + LOCK_MS), twoFaFailures: 0 } });
    throw new UnauthorizedException('Código incorrecto');
  }
}
