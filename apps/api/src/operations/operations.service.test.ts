import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessAccountStatus,
  BusinessAccountUserRole,
  InventoryCountStatus,
  PriceListType,
  PurchaseOrderStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationsService } from './operations.service';

function setup() {
  const prisma = {
    product: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    stockItem: { upsert: vi.fn() },
    purchaseOrder: { findUnique: vi.fn(), update: vi.fn() },
    priceList: { create: vi.fn(), findFirst: vi.fn() },
    inventoryCount: { findUnique: vi.fn(), update: vi.fn() },
    inventoryCountItem: { update: vi.fn() },
    businessAccountUser: { findFirst: vi.fn(), count: vi.fn() },
    order: { findUnique: vi.fn() },
    $transaction: vi.fn(async (operation: unknown) => {
      if (typeof operation === 'function')
        return (operation as (client: typeof prisma) => unknown)(prisma);
      return Promise.all(operation as Promise<unknown>[]);
    }),
  };
  return {
    prisma,
    service: new OperationsService(prisma as never),
  };
}

describe('OperationsService — fluxos operacionais', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submete uma compra em rascunho e fixa a data de emissão', async () => {
    const { prisma, service } = setup();
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: 'purchase-id',
      status: PurchaseOrderStatus.DRAFT,
      issuedAt: null,
      receipts: [],
    });
    prisma.purchaseOrder.update.mockResolvedValue({
      id: 'purchase-id',
      status: PurchaseOrderStatus.SUBMITTED,
    });
    await expect(
      service.setPurchaseStatus('purchase-id', PurchaseOrderStatus.SUBMITTED),
    ).resolves.toEqual(
      expect.objectContaining({ status: PurchaseOrderStatus.SUBMITTED }),
    );
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PurchaseOrderStatus.SUBMITTED,
          issuedAt: expect.any(Date) as unknown,
        }) as unknown,
      }),
    );
  });

  it('protege estados finais de compras', async () => {
    const { prisma, service } = setup();
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: 'purchase-id',
      status: PurchaseOrderStatus.RECEIVED,
      issuedAt: new Date(),
      receipts: [{ id: 'receipt' }],
    });
    await expect(
      service.setPurchaseStatus('purchase-id', PurchaseOrderStatus.CANCELLED),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it('não configura stock para um produto inexistente', async () => {
    const { prisma, service } = setup();
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(
      service.configureStock('missing', { reorderPoint: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.stockItem.upsert).not.toHaveBeenCalled();
  });

  it('recusa produtos repetidos numa tabela de preços', async () => {
    const { prisma, service } = setup();
    await expect(
      service.createPriceList({
        name: 'Revenda',
        code: 'REV',
        type: PriceListType.RESELLER,
        items: [
          { productId: 'same', priceCents: 100 },
          { productId: 'same', priceCents: 90 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.priceList.create).not.toHaveBeenCalled();
  });

  it('impede um membro de consulta de criar encomendas B2B', async () => {
    const { prisma, service } = setup();
    prisma.businessAccountUser.findFirst.mockResolvedValue({
      role: BusinessAccountUserRole.VIEWER,
      businessAccount: {
        id: 'business-id',
        status: BusinessAccountStatus.APPROVED,
        priceList: null,
      },
    });
    await expect(
      service.createB2BOrder('user-id', 'product-id', 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('não limita produtos cujo controlo quantitativo está desativado', async () => {
    const { prisma, service } = setup();
    prisma.businessAccountUser.findFirst.mockResolvedValue(null);
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'legacy-product',
        name: 'Produto existente',
        priceCents: 500,
        minimumOrderQuantity: 1,
        stockItem: {
          trackStock: false,
          onHandQuantity: 0,
          reservedQuantity: 0,
        },
      },
    ]);
    await expect(service.resolvedCatalog('user-id')).resolves.toEqual([
      expect.objectContaining({
        id: 'legacy-product',
        availableQuantity: null,
      }),
    ]);
  });

  it('reutiliza uma encomenda B2B com a mesma chave de idempotência', async () => {
    const { prisma, service } = setup();
    prisma.businessAccountUser.findFirst.mockResolvedValue({
      role: BusinessAccountUserRole.BUYER,
      businessAccount: {
        id: 'business-id',
        status: BusinessAccountStatus.APPROVED,
        priceList: null,
      },
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-id',
      userId: 'user-id',
      businessAccountId: 'business-id',
      items: [],
      stockReservations: [],
    });
    await expect(
      service.createB2BOrder(
        'user-id',
        'product-id',
        1,
        undefined,
        'request-key',
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'order-id' }));
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('recusa contagens de produtos fora do inventário', async () => {
    const { prisma, service } = setup();
    prisma.inventoryCount.findUnique.mockResolvedValue({
      id: 'inventory-id',
      status: InventoryCountStatus.IN_PROGRESS,
      items: [{ id: 'item-id', productId: 'product-one' }],
    });
    await expect(
      service.updateInventory('inventory-id', {
        items: [{ productId: 'product-two', countedQuantity: 4 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.inventoryCountItem.update).not.toHaveBeenCalled();
  });
});
