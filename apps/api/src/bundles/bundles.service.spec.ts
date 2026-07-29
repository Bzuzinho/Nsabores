import { ConflictException, BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma.service';
import { BundlesService } from './bundles.service';

const fixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'bundle-1',
  productId: 'product-parent',
  mode: 'CONFIGURABLE' as const,
  pricingMode: 'PRODUCT_PRICE' as const,
  minimumSelections: 2,
  maximumSelections: 4,
  isActive: true,
  createdAt: new Date('2026-07-29T00:00:00Z'),
  updatedAt: new Date('2026-07-29T00:00:00Z'),
  productName: 'Cabaz',
  productSlug: 'cabaz',
  productPriceCents: 2000,
  productImageUrl: '/cabaz.jpg',
  groups: [
    {
      id: 'group-1',
      bundleId: 'bundle-1',
      code: 'SABORES',
      name: 'Sabores',
      minimumSelections: 2,
      maximumSelections: 3,
      sortOrder: 0,
    },
  ],
  items: [
    {
      id: 'item-a',
      bundleId: 'bundle-1',
      productId: 'product-a',
      groupId: 'group-1',
      quantity: 1,
      isRequired: false,
      minimumQuantity: 0,
      maximumQuantity: 3,
      priceDeltaCents: 100,
      sortOrder: 0,
      isActive: true,
      productName: 'A',
      productSlug: 'a',
      productSku: 'A',
      productPriceCents: 600,
      productImageUrl: '/a.jpg',
      stockStatus: 'IN_STOCK',
    },
    {
      id: 'item-b',
      bundleId: 'bundle-1',
      productId: 'product-b',
      groupId: 'group-1',
      quantity: 1,
      isRequired: false,
      minimumQuantity: 0,
      maximumQuantity: 3,
      priceDeltaCents: 0,
      sortOrder: 1,
      isActive: true,
      productName: 'B',
      productSlug: 'b',
      productSku: 'B',
      productPriceCents: 700,
      productImageUrl: '/b.jpg',
      stockStatus: 'IN_STOCK',
    },
  ],
  personalization: {
    allowGiftMessage: true,
    allowRecipientName: true,
    allowSpecialPackaging: true,
    specialPackagingCents: 250,
    allowRequestedDate: true,
    allowNotes: true,
    allowHidePrice: true,
    messageMaxLength: 300,
    notesMaxLength: 500,
  },
  ...overrides,
});

function serviceWith(bundle: ReturnType<typeof fixture>) {
  const service = new BundlesService({} as PrismaService);
  vi.spyOn(service, 'publicBySlug').mockResolvedValue(bundle);
  return service;
}

describe('BundlesService pricing', () => {
  it('prices PRODUCT_PRICE with selection deltas and packaging', async () => {
    const service = serviceWith(fixture());
    const result = await service.priceBySlug('cabaz', {
      selections: [
        { bundleItemId: 'item-a', quantity: 1 },
        { bundleItemId: 'item-b', quantity: 1 },
      ],
      specialPackaging: true,
    });

    expect(result.selectionDeltaCents).toBe(100);
    expect(result.packagingCents).toBe(250);
    expect(result.priceCents).toBe(2350);
    expect(result.composition).toHaveLength(2);
  });

  it('prices COMPONENT_TOTAL from component prices, deltas and packaging', async () => {
    const service = serviceWith(
      fixture({ pricingMode: 'COMPONENT_TOTAL' as const }),
    );
    const result = await service.priceBySlug('cabaz', {
      selections: [
        { bundleItemId: 'item-a', quantity: 2 },
        { bundleItemId: 'item-b', quantity: 1 },
      ],
      specialPackaging: true,
    });

    expect(result.componentTotalCents).toBe(2100);
    expect(result.packagingCents).toBe(250);
    expect(result.priceCents).toBe(2350);
  });

  it('rejects a configurable bundle below the global minimum', async () => {
    const service = serviceWith(fixture());
    await expect(
      service.priceBySlug('cabaz', {
        selections: [{ bundleItemId: 'item-a', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a selection above the group maximum', async () => {
    const service = serviceWith(fixture());
    await expect(
      service.priceBySlug('cabaz', {
        selections: [
          { bundleItemId: 'item-a', quantity: 2 },
          { bundleItemId: 'item-b', quantity: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an out-of-stock selected component', async () => {
    const outOfStock = fixture();
    outOfStock.items[0].stockStatus = 'OUT_OF_STOCK';
    const service = serviceWith(outOfStock);

    await expect(
      service.priceBySlug('cabaz', {
        selections: [
          { bundleItemId: 'item-a', quantity: 1 },
          { bundleItemId: 'item-b', quantity: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
