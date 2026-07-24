import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ProductQueryDto } from './dto';

@Controller('v1')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Get('categories/:slug')
  category(@Param('slug') slug: string) {
    return this.catalog.getCategory(slug);
  }

  @Get('products')
  products(@Query() query: ProductQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalog.getProduct(slug);
  }
}
