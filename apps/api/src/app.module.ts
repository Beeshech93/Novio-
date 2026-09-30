import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { PlansController } from './plans/plans.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 16) throw new Error('JWT_SECRET must be set (16+ chars)');
        return { secret, signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } };
      },
    }),
    PrismaModule,
  ],
  controllers: [AuthController, BusinessesController, PlansController, DashboardController, ProductsController, CustomersController],
  providers: [
    AuthService,
    ProductsService,
    CustomersService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
