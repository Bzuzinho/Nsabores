import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  CategoryQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto';

const categorySummary = { id: true, name: true, slug: true } as const;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories(isAdmin = false, query: CategoryQueryDto = {}) {
    return this.prisma.category.findMany({
      where: isAdmin
        ? query.active === undefined
          ? {}
          : { isActive: query.active }
        : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getCategory(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, isActive: true },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    return category;
  }

  async listProducts(query: ProductQueryDto, isAdmin = false) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const search = query.search?.trim().slice(0, 100);
    const where: Prisma.ProductWhereInput = {
      ...(isAdmin
        ? query.active === undefined
          ? {}
          : { isActive: query.active }
        : { isActive: true, channel: { in: ['B2C_ONLY', 'BOTH'] } }),
      ...(query.featured === undefined ? {} : { isFeatured: query.featured }),
      ...(query.stockStatus ? { stockStatus: query.stockStatus } : {}),
      ...(!isAdmin
        ? {
            category: {
              isActive: true,
              ...(query.category ? { slug: query.category } : {}),
            },
          }
        : query.category
          ? { category: { slug: query.category } }
          : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { shortDescription: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const field =
      query.sort === 'price'
        ? 'priceCents'
        : query.sort === 'name'
          ? 'name'
          : 'createdAt';
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: { select: categorySummary } },
        orderBy: { [field]: query.order ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getProduct(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        isActive: true,
        channel: { in: ['B2C_ONLY', 'BOTH'] },
        category: { isActive: true },
      },
      include: { category: { select: categorySummary } },
    });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  createCategory(data: CreateCategoryDto) {
    return this.unique(() => this.prisma.category.create({ data }));
  }

  updateCategory(id: string, data: UpdateCategoryDto) {
    return this.unique(() =>
      this.prisma.category.update({ where: { id }, data }),
    );
  }

  async deleteCategory(id: string) {
    const products = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (products > 0) {
      throw new ConflictException(
        'A categoria tem produtos associados. Desative-a em vez de eliminar.',
      );
    }
    return this.prisma.category.delete({ where: { id } });
  }

  createProduct(data: CreateProductDto) {
    return this.unique(() =>
      this.prisma.product.create({
        data,
        include: { category: { select: categorySummary } },
      }),
    );
  }

  updateProduct(id: string, data: UpdateProductDto) {
    return this.unique(() =>
      this.prisma.product.update({
        where: { id },
        data,
        include: { category: { select: categorySummary } },
      }),
    );
  }

  async deleteProduct(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: { category: { select: categorySummary } },
    });
  }

  private async unique<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Slug ou SKU já existe.');
        if (error.code === 'P2025')
          throw new NotFoundException('Registo não encontrado.');
      }
      throw error;
    }
  }
}
