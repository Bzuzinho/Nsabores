import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { BundleCartDto } from './dto';
import { BundlesService } from './bundles.service';

interface CartLineRow {
  id: string;
  quantity: number;
}

interface StockRow {
  productId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  trackStock: boolean;
}

@Injectable()
export class BundleCartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bundles: BundlesService,
  ) {}

  async add(cartId: string, slug: string, body: BundleCartDto) {
    const bundle = await this.bundles.publicBySlug(slug);
    const personalization = this.validatePersonalization(bundle, body.personalization ?? {});
    const pricing = await this.bundles.priceBySlug(slug, {
      selections: body.selections,
      specialPackaging: personalization.specialPackaging,
    });
    await this.assertComponentStock(pricing.composition, body.quantity);

    const configurationKey = createHash('sha256')
      .update(
        JSON.stringify({
          bundleId: bundle.id,
          composition: pricing.composition.map((line) => [line.bundleItemId, line.quantity]),
          personalization,
        }),
      )
      .digest('hex');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRaw<CartLineRow[]>`
        SELECT "id", "quantity"
        FROM "CartItem"
        WHERE "cartId" = ${cartId}::uuid
          AND "productId" = ${bundle.productId}::uuid
          AND "configurationKey" = ${configurationKey}
        LIMIT 1
        FOR UPDATE
      `;
      const current = existing[0];
      const nextQuantity = (current?.quantity ?? 0) + body.quantity;
      if (nextQuantity > 99) throw new BadRequestException('Quantidade máxima: 99.');

      const cartItemId = current?.id ?? randomUUID();
      if (current) {
        await tx.$executeRaw`
          UPDATE "CartItem"
          SET "quantity" = ${nextQuantity}, "unitPriceCents" = ${pricing.priceCents}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${cartItemId}::uuid
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO "CartItem" (
            "id", "cartId", "productId", "configurationKey", "quantity", "unitPriceCents", "createdAt", "updatedAt"
          ) VALUES (
            ${cartItemId}::uuid, ${cartId}::uuid, ${bundle.productId}::uuid, ${configurationKey},
            ${body.quantity}, ${pricing.priceCents}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;

        for (const line of pricing.composition) {
          const definition = bundle.items.find((item) => item.id === line.bundleItemId);
          await tx.$executeRaw`
            INSERT INTO "CartItemBundleSelection" (
              "id", "cartItemId", "componentProductId", "groupId", "quantity", "unitPriceDeltaCents", "createdAt"
            ) VALUES (
              ${randomUUID()}::uuid, ${cartItemId}::uuid, ${line.productId}::uuid,
              ${definition?.groupId ?? null}::uuid, ${line.quantity}, ${line.unitPriceDeltaCents}, CURRENT_TIMESTAMP
            )
          `;
        }

        if (Object.keys(personalization).length) {
          await tx.$executeRaw`
            INSERT INTO "CartItemPersonalization" (
              "id", "cartItemId", "data", "extraPriceCents", "createdAt", "updatedAt"
            ) VALUES (
              ${randomUUID()}::uuid, ${cartItemId}::uuid, ${JSON.stringify(personalization)}::jsonb,
              ${pricing.packagingCents}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `;
        }
      }

      return { cartItemId, configurationKey, unitPriceCents: pricing.priceCents, quantity: nextQuantity };
    });
  }

  private validatePersonalization(
    bundle: Awaited<ReturnType<BundlesService['publicBySlug']>>,
    input: BundleCartDto['personalization'] extends infer T ? NonNullable<T> : never,
  ) {
    const config = bundle.personalization;
    const result: Record<string, string | boolean> = {};
    if (input.giftMessage) {
      if (!config?.allowGiftMessage) throw new BadRequestException('Este cabaz não aceita mensagem de oferta.');
      if (input.giftMessage.length > config.messageMaxLength) throw new BadRequestException('A mensagem de oferta é demasiado longa.');
      result.giftMessage = input.giftMessage.trim();
    }
    if (input.recipientName) {
      if (!config?.allowRecipientName) throw new BadRequestException('Este cabaz não aceita nome de destinatário.');
      result.recipientName = input.recipientName.trim();
    }
    if (input.specialPackaging) {
      if (!config?.allowSpecialPackaging) throw new BadRequestException('A embalagem especial não está disponível.');
      result.specialPackaging = true;
    }
    if (input.requestedDate) {
      if (!config?.allowRequestedDate) throw new BadRequestException('Este cabaz não permite escolher data.');
      result.requestedDate = input.requestedDate;
    }
    if (input.notes) {
      if (!config?.allowNotes) throw new BadRequestException('Este cabaz não aceita observações.');
      if (input.notes.length > config.notesMaxLength) throw new BadRequestException('As observações são demasiado longas.');
      result.notes = input.notes.trim();
    }
    if (input.hidePrice) {
      if (!config?.allowHidePrice) throw new BadRequestException('Este cabaz não permite ocultar o preço.');
      result.hidePrice = true;
    }
    return result;
  }

  private async assertComponentStock(
    composition: Array<{ productId: string; quantity: number; name: string }>,
    bundleQuantity: number,
  ) {
    for (const component of composition) {
      const rows = await this.prisma.$queryRaw<StockRow[]>`
        SELECT "productId", "onHandQuantity", "reservedQuantity", "trackStock"
        FROM "StockItem"
        WHERE "productId" = ${component.productId}::uuid
        LIMIT 1
      `;
      const stock = rows[0];
      if (!stock || !stock.trackStock) continue;
      const needed = component.quantity * bundleQuantity;
      if (stock.onHandQuantity - stock.reservedQuantity < needed) {
        throw new ConflictException(`Stock insuficiente para ${component.name}.`);
      }
    }
  }
}
