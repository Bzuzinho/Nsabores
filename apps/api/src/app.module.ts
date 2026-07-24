import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import Joi from 'joi';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { CatalogService } from './catalog/catalog.service';
import { CatalogController } from './catalog/catalog.controller';
import { AdminCatalogController } from './catalog/admin-catalog.controller';
import { AuthController } from './auth/auth.controller';
import { AccountController } from './auth/account.controller';
import { AdminUsersController } from './auth/admin-users.controller';
import { AuthService } from './auth/auth.service';
import { AccountService } from './auth/account.service';
import { AdminUsersService } from './auth/admin-users.service';
import { AuthGuard, RolesGuard } from './auth/auth.guards';
import { MailProvider } from './auth/mail.provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        CORS_ORIGINS: Joi.string().default(
          'http://localhost:3000,http://localhost:3001',
        ),
        DATABASE_URL: Joi.string().uri().optional(),
        AUTH_ACCESS_TOKEN_SECRET: Joi.string()
          .min(32)
          .when('NODE_ENV', {
            is: 'production',
            then: Joi.required(),
            otherwise: Joi.string().default(
              'development-only-secret-change-me',
            ),
          }),
        AUTH_ACCESS_TOKEN_TTL: Joi.string()
          .pattern(/^\d+[mhd]$/)
          .default('15m'),
        AUTH_REFRESH_TOKEN_TTL: Joi.string()
          .pattern(/^\d+[mhd]$/)
          .default('30d'),
        PASSWORD_RESET_TOKEN_TTL: Joi.string()
          .pattern(/^\d+[mhd]$/)
          .default('1h'),
        EMAIL_VERIFICATION_TOKEN_TTL: Joi.string()
          .pattern(/^\d+[mhd]$/)
          .default('24h'),
        AUTH_COOKIE_DOMAIN: Joi.string().allow('').optional(),
        AUTH_COOKIE_SECURE: Joi.boolean().default(false),
        WEBSITE_URL: Joi.string().uri().default('http://localhost:3000'),
        MANAGEMENT_URL: Joi.string().uri().default('http://localhost:3001'),
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().port().default(4000),
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('AUTH_ACCESS_TOKEN_SECRET'),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [
    HealthController,
    CatalogController,
    AdminCatalogController,
    AuthController,
    AccountController,
    AdminUsersController,
  ],
  providers: [
    PrismaService,
    CatalogService,
    AuthService,
    AccountService,
    AdminUsersService,
    AuthGuard,
    RolesGuard,
    MailProvider,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
