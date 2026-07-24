import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { CatalogService } from './catalog/catalog.service';
import { CatalogController } from './catalog/catalog.controller';
import { AdminCatalogController } from './catalog/admin-catalog.controller';
import { AdminApiKeyGuard } from './catalog/admin-api-key.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        CORS_ORIGINS: Joi.string().default(
          'http://localhost:3000,http://localhost:3001',
        ),
        DATABASE_URL: Joi.string().uri().optional(),
        ADMIN_API_KEY: Joi.string().min(16).when('NODE_ENV', {
          is: 'production',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().port().default(4000),
      }),
    }),
  ],
  controllers: [HealthController, CatalogController, AdminCatalogController],
  providers: [PrismaService, CatalogService, AdminApiKeyGuard],
})
export class AppModule {}
