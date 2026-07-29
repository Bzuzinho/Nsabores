import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import { BundlePriceDto, BundleUpsertDto } from './dto';
import { BundlesService } from './bundles.service';

@Controller('v1/bundles')
export class PublicBundlesController {
  constructor(private readonly bundles: BundlesService) {}

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.bundles.publicBySlug(slug);
  }

  @Post(':slug/price')
  price(@Param('slug') slug: string, @Body() body: BundlePriceDto) {
    return this.bundles.priceBySlug(slug, body);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/bundles')
export class AdminBundlesController {
  constructor(private readonly bundles: BundlesService) {}

  @Get()
  list() {
    return this.bundles.listAdmin();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.bundles.detail(id);
  }

  @Post()
  create(@Body() body: BundleUpsertDto) {
    return this.bundles.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: BundleUpsertDto) {
    return this.bundles.update(id, body);
  }
}
