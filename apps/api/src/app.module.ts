import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin/admin.controller';
import { FeatureGuard } from './common/feature.guard';
import { BILLING_PROVIDERS, BillingProvider } from './subscriptions/billing-provider';
import { MockBillingProvider } from './subscriptions/mock-billing.provider';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { WebsitesController } from './websites/websites.controller';
import { WebsitesService } from './websites/websites.service';
import { AppointmentsController } from './appointments/appointments.controller';
import { AppointmentsService } from './appointments/appointments.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { EMAIL_PROVIDER, LogProvider, MetaWhatsAppProvider, ResendEmailProvider, WHATSAPP_PROVIDER } from './notifications/providers';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AutomationsService } from './automations/automations.service';
import { MarketingController } from './marketing/marketing.controller';
import { MarketingService } from './marketing/marketing.service';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { AI_GENERATOR, AnthropicGenerator } from './ai/generator';
import { HealthController } from './health/health.controller';
import { StorageController } from './storage/storage.controller';
import { StorageService } from './storage/storage.service';
import { TwoFactorService } from './auth/two-factor.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { BusinessesController } from './businesses/businesses.controller';
import { AuthGuard } from './common/auth.guard';
import { RolesGuard } from './common/roles.guard';
import { DashboardController } from './dashboard/dashboard.controller';
import { CustomersController } from './customers/customers.controller';
import { CustomersService } from './customers/customers.service';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { PAYMENT_PROVIDERS, PaymentProvider } from './payments/payment-provider';
import { MockPaymentProvider } from './payments/mock.provider';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { PlansController } from './plans/plans.controller';
import { resolveJwtSecret } from './common/jwt-secret';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [PrismaService],
      useFactory: async (prisma: PrismaService) => ({
        secret: await resolveJwtSecret(prisma),
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
      }),
    }),
    PrismaModule,
  ],
  controllers: [AuthController, BusinessesController, PlansController, DashboardController, ProductsController, CustomersController, OrdersController, PaymentsController, SubscriptionsController, AdminController, WebsitesController, AppointmentsController, NotificationsController, MarketingController, AnalyticsController, AiController, HealthController, StorageController],
  providers: [
    AuthService,
    TwoFactorService,
    ProductsService,
    CustomersService,
    OrdersService,
    PaymentsService,
    SubscriptionsService,
    WebsitesService,
    AppointmentsService,
    NotificationsService,
    MarketingService,
    AutomationsService,
    AnalyticsService,
    AiService,
    { provide: StorageService, useFactory: () => new StorageService() },
    {
      provide: AI_GENERATOR,
      // Connect by setting ANTHROPIC_API_KEY. AI_MODEL overrides the default fast/cheap model.
      useFactory: () => process.env.ANTHROPIC_API_KEY
        ? new AnthropicGenerator(process.env.ANTHROPIC_API_KEY, process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001')
        : undefined,
    },
    {
      provide: EMAIL_PROVIDER,
      // Connect by setting RESEND_API_KEY + EMAIL_FROM. In development, falls back to logging.
      useFactory: () => process.env.RESEND_API_KEY && process.env.EMAIL_FROM
        ? new ResendEmailProvider(process.env.RESEND_API_KEY, process.env.EMAIL_FROM)
        : process.env.NODE_ENV !== 'production' ? new LogProvider() : undefined,
    },
    {
      provide: WHATSAPP_PROVIDER,
      // Official Meta Cloud API. Connect by setting WHATSAPP_TOKEN + WHATSAPP_PHONE_ID.
      useFactory: () => process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID
        ? new MetaWhatsAppProvider(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_PHONE_ID)
        : process.env.NODE_ENV !== 'production' ? new LogProvider() : undefined,
    },
    {
      provide: BILLING_PROVIDERS,
      // Connect a real billing processor here (Stripe / Mercado Pago / Conekta) and set BILLING_PROVIDER.
      useFactory: () => {
        const providers = new Map<string, BillingProvider>();
        if (process.env.NODE_ENV !== 'production') providers.set('mock', new MockBillingProvider(process.env.BILLING_WEBHOOK_SECRET ?? 'dev-only-secret'));
        return providers;
      },
    },
    {
      provide: PAYMENT_PROVIDERS,
      // Real processors get registered here. The mock (dev/test only) is never available in production.
      useFactory: () => {
        const providers = new Map<string, PaymentProvider>();
        if (process.env.NODE_ENV !== 'production') {
          providers.set('mock', new MockPaymentProvider(process.env.PAYMENT_WEBHOOK_SECRET ?? 'dev-only-secret'));
        }
        return providers;
      },
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
})
export class AppModule {}
