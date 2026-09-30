import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Behind Vercel/Render the socket IP is the proxy's. Set TRUST_PROXY_HOPS to the number of proxies in front (default 1).
  (app.getHttpAdapter().getInstance() as import('express').Express).set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Nuvio API').setVersion('1').addBearerAuth().build());
  SwaggerModule.setup('api/docs', app, doc);

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
