import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug';
import { TRIAL_DAYS } from '../subscriptions/access';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

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

    return { token: await this.sign(user.id), user: this.publicUser(user), business };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email.toLowerCase().trim(), deletedAt: null } });
    // Always run a hash comparison so timing doesn't reveal whether the email exists.
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    if (!user || !ok) throw new UnauthorizedException('Correo o contraseña incorrectos');
    return { token: await this.sign(user.id), user: this.publicUser(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      include: { memberships: { include: { business: true } } },
    });
    return {
      ...this.publicUser(user),
      businesses: user.memberships.map((m) => ({ ...m.business, role: m.role })),
    };
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
