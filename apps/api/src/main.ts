import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { bootstrapAdmin } from './bootstrap-admin';

function applyProductionCookiePolicy(response: Response) {
  const cookie = response.cookie.bind(response);
  const clearCookie = response.clearCookie.bind(response);

  response.cookie = ((name, value, options = {}) =>
    cookie(name, value, {
      ...options,
      secure: true,
      sameSite: 'none',
    })) as Response['cookie'];

  response.clearCookie = ((name, options = {}) =>
    clearCookie(name, {
      ...options,
      secure: true,
      sameSite: 'none',
    })) as Response['clearCookie'];
}

async function bootstrap() {
  await bootstrapAdmin();

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const production = config.get<string>('NODE_ENV') === 'production';

  app.use(cookieParser());
  if (production) {
    app.use((_request: Request, response: Response, next: NextFunction) => {
      applyProductionCookiePolicy(response);
      next();
    });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({ origin: origins, credentials: true });
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    const origin = request.header('origin');
    if ((!origin && production) || (origin && !origins.includes(origin))) {
      response.status(403).json({ message: 'Origem não autorizada.' });
      return;
    }
    next();
  });
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
}

void bootstrap();
