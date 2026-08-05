import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { ContentService } from './content.service';
import {
  BlogQueryDto,
  ContactRequestDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from './dto';

@Controller('v1')
export class PublicContentController {
  constructor(private readonly content: ContentService) {}

  @Get('blog')
  blog(@Query() query: BlogQueryDto) {
    return this.content.listPublic(query);
  }

  @Get('blog/:slug')
  post(@Param('slug') slug: string) {
    return this.content.publicPost(slug);
  }

  @Post('contact')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  contact(@Body() body: ContactRequestDto) {
    return this.content.contact(body);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/blog')
export class AdminBlogController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(@Query() query: BlogQueryDto) {
    return this.content.listAdmin(query);
  }

  @Get(':id')
  post(@Param('id') id: string) {
    return this.content.adminPost(id);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() body: CreateBlogPostDto) {
    return this.content.create(body, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateBlogPostDto) {
    return this.content.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.content.delete(id);
  }
}
