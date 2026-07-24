import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service';

const mockPrisma = () => {
  const product = {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const category = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    product,
    category,
    $transaction: vi.fn(async (operations: unknown[]) =>
      Promise.all(operations),
    ),
  };
};

describe('CatalogService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: CatalogService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new CatalogService(prisma as never);
  });

  it('lists active products with category, search and pagination', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'one' }]);
    prisma.product.count.mockResolvedValue(21);
    const result = await service.listProducts({
      category: 'queijos',
      search: 'serra',
      page: 2,
      limit: 10,
      sort: 'name',
      order: 'asc',
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
    const [[call]] = prisma.product.findMany.mock.calls as unknown as [
      [
        {
          where: {
            isActive: boolean;
            category: { isActive: boolean; slug: string };
            OR: unknown[];
          };
          skip: number;
          take: number;
        },
      ],
    ];
    expect(call.where.isActive).toBe(true);
    expect(call.where.category).toEqual({ isActive: true, slug: 'queijos' });
    expect(call.where.OR).toHaveLength(3);
    expect({ skip: call.skip, take: call.take }).toEqual({
      skip: 10,
      take: 10,
    });
  });

  it('returns detail by active slug and rejects missing products', async () => {
    prisma.product.findFirst
      .mockResolvedValueOnce({ slug: 'produto' })
      .mockResolvedValueOnce(null);
    await expect(service.getProduct('produto')).resolves.toEqual({
      slug: 'produto',
    });
    await expect(service.getProduct('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates and edits administrative products', async () => {
    prisma.product.create.mockResolvedValue({ id: 'one' });
    prisma.product.update.mockResolvedValue({ id: 'one', isFeatured: true });
    await expect(
      service.createProduct({ name: 'Produto' } as never),
    ).resolves.toEqual({ id: 'one' });
    await expect(
      service.updateProduct('one', { isFeatured: true }),
    ).resolves.toEqual({ id: 'one', isFeatured: true });
  });

  it('prevents deleting categories with products', async () => {
    prisma.product.count.mockResolvedValue(2);
    await expect(service.deleteCategory('category')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });

  it('soft deletes products', async () => {
    prisma.product.update.mockResolvedValue({ id: 'one', isActive: false });
    await service.deleteProduct('one');
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });
});
