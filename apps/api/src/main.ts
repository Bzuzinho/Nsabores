import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { CookieOptions, NextFunction, Request, Response } from 'express';

const optionalBootstrapVariables = [
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD_HASH',
] as const;

function removeEmptyOptionalEnvironmentVariables() {
  for (const name of optionalBootstrapVariables) {
    if (process.env[name]?.trim() === '') delete process.env[name];
  }
}

function productionCookieOptions(options?: CookieOptions): CookieOptions {
  return {
    ...(options ?? {}),
    secure: true,
    sameSite: 'none',
  };
}

function applyProductionCookiePolicy(response: Response) {
  const cookie = response.cookie.bind(response);
  const clearCookie = response.clearCookie.bind(response);

  response.cookie = ((name: string, value: string, options?: CookieOptions) =>
    cookie(
      name,
      value,
      productionCookieOptions(options),
    )) as Response['cookie'];

  response.clearCookie = ((name: string, options?: CookieOptions) =>
    clearCookie(
      name,
      productionCookieOptions(options),
    )) as Response['clearCookie'];
}

async function bootstrap() {
  removeEmptyOptionalEnvironmentVariables();
  const { AppModule } = await import('./app.module.js');
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
