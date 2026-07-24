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
import { CatalogService } from './catalog.service';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import {
  CategoryQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto';

@UseGuards(AdminApiKeyGuard)
@Controller('v1/admin')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories(@Query() query: CategoryQueryDto) {
    return this.catalog.listCategories(true, query);
  }

  @Post('categories')
  createCategory(@Body() body: CreateCategoryDto) {
    return this.catalog.createCategory(body);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return this.catalog.updateCategory(id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.catalog.deleteCategory(id);
  }

  @Get('products')
  products(@Query() query: ProductQueryDto) {
    return this.catalog.listProducts(query, true);
  }

  @Post('products')
  createProduct(@Body() body: CreateProductDto) {
    return this.catalog.createProduct(body);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.catalog.updateProduct(id, body);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.catalog.deleteProduct(id);
  }
}
