import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug';
import { TRIAL_DAYS } from '../subscriptions/access';
import { TwoFactorService } from './two-factor.service';
import { LoginDto, RegisterDto } from './auth.dto';

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const HOUR = 3_600_000;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private notifications?: NotificationsService, private twoFactor?: TwoFactorService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const slug = await this.uniqueSlug(dto.business.name);

    // One transaction: user + business + OWNER membership + default setup.
    const { user, business } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: dto.name, email, phone: dto.phone, passwordHash } });
      const business = await tx.business.create({
        data: { ...dto.business, goals: dto.goals ?? [], slug },
      });
      await tx.businessMember.create({ data: { businessId: business.id, userId: user.id, role: 'OWNER' } });
      await tx.website.create({ data: { businessId: business.id, subdomain: slug } });
      // 14-day trial of the entry plan (skipped if plans haven't been seeded yet).
      const plan = await tx.plan.findFirst({ where: { slug: 'basico', billingInterval: 'MONTHLY', active: true } });
      if (plan) {
        const now = new Date();
        await tx.subscription.create({
          data: { businessId: business.id, planId: plan.id, provider: 'trial', status: 'trialing', billingInterval: 'MONTHLY', currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + TRIAL_DAYS * 86_400_000) },
        });
      }
      await tx.auditLog.create({
        data: { businessId: business.id, userId: user.id, action: 'business.created', entity: 'business', entityId: business.id },
      });
      return { user, business };
    });

    const web = (process.env.WEB_ORIGIN ?? '').split(',')[0];
    void this.sendVerification(user.id, business.id, user.name, user.email).catch(() => undefined);
    void this.notifications?.sendEmail(business.id, user.email, 'welcome', { name: user.name, url: web ? `${web}/dashboard` : undefined }).catch(() => undefined);
    return { token: await this.sign(user.id), user: this.publicUser(user), business };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email.toLowerCase().trim(), deletedAt: null } });
    // Always run a hash comparison so timing doesn't reveal whether the email exists.
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    if (!user || !ok) throw new UnauthorizedException('Correo o contraseña incorrectos');
    if (user.totpEnabled && this.twoFactor) return { twoFactorRequired: true as const, challenge: await this.twoFactor.challenge(user.id) };
    return { twoFactorRequired: false as const, token: await this.sign(user.id), user: this.publicUser(user) };
  }

  /** Issues the session after the second factor passed. */
  async sessionFor(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    return { token: await this.sign(user.id), user: this.publicUser(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      include: { memberships: { include: { business: true } } },
    });
    return {
      ...this.publicUser(user),
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.totpEnabled,
      businesses: user.memberships.map((m) => ({ ...m.business, role: m.role })),
    };
  }

  // ---------- email verification & password reset ----------

  /** Creates a single-use token (stored hashed) and emails the link. Older unused tokens of the same kind are revoked. */
  private async issueToken(userId: string, kind: 'verify_email' | 'password_reset', ttlMs: number) {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({ where: { userId, kind, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.authToken.create({ data: { userId, kind, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ttlMs) } }),
    ]);
    return raw;
  }

  private webUrl(path: string) {
    const web = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',')[0];
    return `${web}${path}`;
  }

  async sendVerification(userId: string, businessId: string | undefined, name: string, email: string) {
    const token = await this.issueToken(userId, 'verify_email', 24 * HOUR);
    if (businessId) await this.notifications?.sendEmail(businessId, email, 'verify_email', { name, url: this.webUrl(`/verificar-correo?token=${token}`) });
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null }, include: { memberships: { take: 1 } } });
    if (user.emailVerified) return;
    await this.sendVerification(user.id, user.memberships[0]?.businessId, user.name, user.email);
  }

  /** Atomic claim: the token is consumed only if unused, unexpired and of the right kind. */
  private async consume(token: string, kind: 'verify_email' | 'password_reset') {
    const hash = hashToken(token);
    const claim = await this.prisma.authToken.updateMany({ where: { tokenHash: hash, kind, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claim.count !== 1) throw new BadRequestException('El enlace no es válido o ya expiró');
    return this.prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hash } });
  }

  async verifyEmail(token: string) {
    const t = await this.consume(token, 'verify_email');
    await this.prisma.user.update({ where: { id: t.userId }, data: { emailVerified: true } });
  }

  /** Always resolves the same way, so it can't be used to discover which emails have accounts. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({ where: { email: email.toLowerCase().trim(), deletedAt: null }, include: { memberships: { take: 1 } } });
    const businessId = user?.memberships[0]?.businessId;
    if (!user || !businessId) return;
    const token = await this.issueToken(user.id, 'password_reset', HOUR);
    await this.notifications?.sendEmail(businessId, user.email, 'password_reset', { name: user.name, url: this.webUrl(`/restablecer-contrasena?token=${token}`) });
  }

  async resetPassword(token: string, password: string) {
    const t = await this.consume(token, 'password_reset');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      // passwordChangedAt invalidates every session/JWT issued before now.
      this.prisma.user.update({ where: { id: t.userId }, data: { passwordHash, passwordChangedAt: new Date(), emailVerified: true } }),
      this.prisma.authToken.updateMany({ where: { userId: t.userId, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { userId: t.userId, action: 'auth.password_reset' } }),
    ]);
  }

  private sign(userId: string) {
    return this.jwt.signAsync({ sub: userId });
  }

  private publicUser(u: { id: string; name: string; email: string; phone: string | null; platformRole: string }) {
    return { id: u.id, name: u.name, email: u.email, phone: u.phone, platformRole: u.platformRole };
  }

  private async uniqueSlug(name: string) {
    const base = slugify(name);
    let slug = base;
    while (await this.prisma.business.findUnique({ where: { slug } })) {
      slug = `${base}-${randomBytes(2).toString('hex')}`;
    }
    return slug;
  }
}
