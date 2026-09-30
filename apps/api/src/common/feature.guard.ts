import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FEATURE_KEY } from './decorators';
import { AuthedRequest } from './tenant';

/** Enforces plan features server-side. 402 lets the UI show an "upgrade" prompt. */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private reflector: Reflector, private subs: SubscriptionsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!feature) return true;
    const t = ctx.switchToHttp().getRequest<AuthedRequest>().tenant;
    if (!t) return true;
    if ((await this.subs.features(t.businessId)).includes(feature as any)) return true;
    throw new HttpException({ statusCode: 402, message: 'Tu plan no incluye esta función', feature }, HttpStatus.PAYMENT_REQUIRED);
  }
}
