import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type {
  BundleItemDto,
  BundlePriceDto,
  BundleUpsertDto,
  PersonalizationConfigDto,
} from './dto';
import { BundleModeDtoValue } from './dto';

interface BundleRow {
  id: string;
  productId: string;
  mode: 'FIXED' | 'CONFIGURABLE';
  pricingMode: 'PRODUCT_PRICE' | 'COMPONENT_TOTAL';
  minimumSelections: number | null;
  maximumSelections: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  productName: string;
  productSlug: string;
  productPriceCents: number;
  productImageUrl: string;
}

interface GroupRow {
  id: string;
  bundleId: string;
  code: string;
  name: string;
  minimumSelections: number;
  maximumSelections: number | null;
  sortOrder: number;
}

interface ItemRow {
  id: string;
  bundleId: string;
  productId: string;
  groupId: string | null;
  quantity: number;
  isRequired: boolean;
  minimumQuantity: number;
  maximumQuantity: number | null;
  priceDeltaCents: number;
  sortOrder: number;
  isActive: boolean;
  productName: string;
  productSlug: string;
  productSku: string;
  productPriceCents: number;
  productImageUrl: string;
  stockStatus: string;
}

interface PersonalizationRow {
  allowGiftMessage: boolean;
  allowRecipientName: boolean;
  allowSpecialPackaging: boolean;
  specialPackagingCents: number;
  allowRequestedDate: boolean;
  allowNotes: boolean;
  allowHidePrice: boolean;
  messageMaxLength: number;
  notesMaxLength: number;
}

@Injectable()
export class BundlesService {
  constructor(private readonly prisma: PrismaService) {}

  async publicBySlug(slug: string) {
    const rows = await this.prisma.$queryRaw<BundleRow[]>`
      SELECT b.*, p."name" AS "productName", p."slug" AS "productSlug",
             p."priceCents" AS "productPriceCents", p."imageUrl" AS "productImageUrl"
      FROM "ProductBundle" b
      JOIN "Product" p ON p."id" = b."productId"
      WHERE p."slug" = ${slug}
        AND p."isActive" = true
        AND b."isActive" = true
      LIMIT 1
    `;
    const bundle = rows[0];
    if (!bundle) throw new NotFoundException('Cabaz não encontrado.');
    return this.detail(bundle.id, false);
  }

  async listAdmin() {
    return this.prisma.$queryRaw<BundleRow[]>`
      SELECT b.*, p."name" AS "productName", p."slug" AS "productSlug",
             p."priceCents" AS "productPriceCents", p."imageUrl" AS "productImageUrl"
      FROM "ProductBundle" b
      JOIN "Product" p ON p."id" = b."productId"
      ORDER BY b."createdAt" DESC
    `;
  }

  async detail(id: string, admin = true) {
    const rows = await this.prisma.$queryRaw<BundleRow[]>`
      SELECT b.*, p."name" AS "productName", p."slug" AS "productSlug",
             p."priceCents" AS "productPriceCents", p."imageUrl" AS "productImageUrl"
      FROM "ProductBundle" b
      JOIN "Product" p ON p."id" = b."productId"
      WHERE b."id" = ${id}::uuid
        AND (${admin} OR b."isActive" = true)
      LIMIT 1
    `;
    const bundle = rows[0];
    if (!bundle) throw new NotFoundException('Cabaz não encontrado.');
    const [groups, items, personalization] = await Promise.all([
      this.prisma.$queryRaw<GroupRow[]>`
        SELECT "id", "bundleId", "code", "name", "minimumSelections", "maximumSelections", "sortOrder"
        FROM "ProductBundleGroup"
        WHERE "bundleId" = ${id}::uuid
        ORDER BY "sortOrder" ASC, "createdAt" ASC
      `,
      this.prisma.$queryRaw<ItemRow[]>`
        SELECT bi."id", bi."bundleId", bi."productId", bi."groupId", bi."quantity", bi."isRequired",
               bi."minimumQuantity", bi."maximumQuantity", bi."priceDeltaCents", bi."sortOrder", bi."isActive",
               p."name" AS "productName", p."slug" AS "productSlug", p."sku" AS "productSku",
               p."priceCents" AS "productPriceCents", p."imageUrl" AS "productImageUrl",
               p."stockStatus"::text AS "stockStatus"
        FROM "ProductBundleItem" bi
        JOIN "Product" p ON p."id" = bi."productId"
        WHERE bi."bundleId" = ${id}::uuid
          AND (${admin} OR bi."isActive" = true)
        ORDER BY bi."sortOrder" ASC, bi."createdAt" ASC
      `,
      this.prisma.$queryRaw<PersonalizationRow[]>`
        SELECT "allowGiftMessage", "allowRecipientName", "allowSpecialPackaging", "specialPackagingCents",
               "allowRequestedDate", "allowNotes", "allowHidePrice", "messageMaxLength", "notesMaxLength"
        FROM "ProductPersonalization"
        WHERE "productId" = ${bundle.productId}::uuid
        LIMIT 1
      `,
    ]);
    return {
      ...bundle,
      groups,
      items,
      personalization: personalization[0] ?? null,
    };
  }

  async create(body: BundleUpsertDto) {
    this.validateDefinition(body);
    const product = await this.prisma.product.findUnique({
      where: { id: body.productId },
      select: { id: true },
    });
    if (!product)
      throw new NotFoundException('Produto principal não encontrado.');
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ProductBundle" WHERE "productId" = ${body.productId}::uuid LIMIT 1
    `;
    if (existing[0])
      throw new ConflictException('Este produto já tem um cabaz configurado.');
    const id = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "ProductBundle" (
          "id", "productId", "mode", "pricingMode", "minimumSelections", "maximumSelections",
          "isActive", "createdAt", "updatedAt"
        ) VALUES (
          ${id}::uuid, ${body.productId}::uuid, ${body.mode}::"BundleMode",
          ${body.pricingMode}::"BundlePricingMode", ${body.minimumSelections ?? null},
          ${body.maximumSelections ?? null}, ${body.isActive}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
      await this.replaceDefinition(tx, id, body);
    });
    return this.detail(id);
  }

  async update(id: string, body: BundleUpsertDto) {
    await this.detail(id);
    this.validateDefinition(body);
    await this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ProductBundle"
        WHERE "productId" = ${body.productId}::uuid AND "id" <> ${id}::uuid
        LIMIT 1
      `;
      if (duplicate[0])
        throw new ConflictException(
          'Este produto já tem outro cabaz configurado.',
        );
      await tx.$executeRaw`
        UPDATE "ProductBundle" SET
          "productId" = ${body.productId}::uuid,
          "mode" = ${body.mode}::"BundleMode",
          "pricingMode" = ${body.pricingMode}::"BundlePricingMode",
          "minimumSelections" = ${body.minimumSelections ?? null},
          "maximumSelections" = ${body.maximumSelections ?? null},
          "isActive" = ${body.isActive},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}::uuid
      `;
      await tx.$executeRaw`DELETE FROM "ProductBundleItem" WHERE "bundleId" = ${id}::uuid`;
      await tx.$executeRaw`DELETE FROM "ProductBundleGroup" WHERE "bundleId" = ${id}::uuid`;
      await this.replaceDefinition(tx, id, body);
    });
    return this.detail(id);
  }

  async priceBySlug(slug: string, body: BundlePriceDto) {
    const bundle = await this.publicBySlug(slug);
    return this.calculate(bundle, body);
  }

  private calculate(
    bundle: Awaited<ReturnType<BundlesService['detail']>>,
    body: BundlePriceDto,
  ) {
    const items = bundle.items.filter((item) => item.isActive);
    const selected = new Map<string, number>();

    if (bundle.mode === 'FIXED') {
      for (const item of items) selected.set(item.id, item.quantity);
    } else {
      for (const selection of body.selections) {
        const item = items.find(
          (candidate) => candidate.id === selection.bundleItemId,
        );
        if (!item)
          throw new BadRequestException('A seleção contém um artigo inválido.');
        if (item.stockStatus === 'OUT_OF_STOCK')
          throw new ConflictException(`${item.productName} está sem stock.`);
        if (selection.quantity < item.minimumQuantity)
          throw new BadRequestException(
            `Quantidade mínima inválida para ${item.productName}.`,
          );
        if (
          item.maximumQuantity !== null &&
          selection.quantity > item.maximumQuantity
        )
          throw new BadRequestException(
            `Quantidade máxima excedida para ${item.productName}.`,
          );
        selected.set(item.id, selection.quantity);
      }
      for (const item of items.filter((candidate) => candidate.isRequired)) {
        if (!selected.has(item.id))
          selected.set(
            item.id,
            Math.max(item.quantity, item.minimumQuantity, 1),
          );
      }
      const selectionCount = [...selected.values()].reduce(
        (sum, quantity) => sum + quantity,
        0,
      );
      if (
        bundle.minimumSelections !== null &&
        selectionCount < bundle.minimumSelections
      )
        throw new BadRequestException(
          'Ainda não selecionou artigos suficientes para este cabaz.',
        );
      if (
        bundle.maximumSelections !== null &&
        selectionCount > bundle.maximumSelections
      )
        throw new BadRequestException(
          'Selecionou artigos a mais para este cabaz.',
        );
      for (const group of bundle.groups) {
        const groupItems = items.filter((item) => item.groupId === group.id);
        const groupCount = groupItems.reduce(
          (sum, item) => sum + (selected.get(item.id) ?? 0),
          0,
        );
        if (groupCount < group.minimumSelections)
          throw new BadRequestException(
            `Escolha pelo menos ${group.minimumSelections} opção(ões) em ${group.name}.`,
          );
        if (
          group.maximumSelections !== null &&
          groupCount > group.maximumSelections
        )
          throw new BadRequestException(
            `Escolha no máximo ${group.maximumSelections} opção(ões) em ${group.name}.`,
          );
      }
    }

    const composition = [...selected.entries()].map(([id, quantity]) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) throw new BadRequestException('Composição inválida.');
      return {
        bundleItemId: item.id,
        productId: item.productId,
        name: item.productName,
        sku: item.productSku,
        quantity,
        unitPriceCents: item.productPriceCents,
        unitPriceDeltaCents: item.priceDeltaCents,
        totalComponentCents:
          (item.productPriceCents + item.priceDeltaCents) * quantity,
      };
    });
    const componentTotalCents = composition.reduce(
      (sum, item) => sum + item.totalComponentCents,
      0,
    );
    const selectionDeltaCents = composition.reduce(
      (sum, item) => sum + item.unitPriceDeltaCents * item.quantity,
      0,
    );
    const packagingCents =
      body.specialPackaging && bundle.personalization?.allowSpecialPackaging
        ? bundle.personalization.specialPackagingCents
        : 0;
    const priceCents =
      bundle.pricingMode === 'COMPONENT_TOTAL'
        ? componentTotalCents + packagingCents
        : bundle.productPriceCents + selectionDeltaCents + packagingCents;
    return {
      bundleId: bundle.id,
      productId: bundle.productId,
      mode: bundle.mode,
      pricingMode: bundle.pricingMode,
      composition,
      componentTotalCents,
      selectionDeltaCents,
      packagingCents,
      priceCents: Math.max(0, priceCents),
      currency: 'EUR',
    };
  }

  private async replaceDefinition(
    tx: Prisma.TransactionClient,
    bundleId: string,
    body: BundleUpsertDto,
  ) {
    const groupIds = new Map<string, string>();
    for (const group of body.groups) {
      const normalized = group.code.trim().toUpperCase().replace(/\s+/g, '-');
      if (groupIds.has(normalized))
        throw new BadRequestException('Existem grupos duplicados.');
      const id = randomUUID();
      groupIds.set(normalized, id);
      await tx.$executeRaw`
        INSERT INTO "ProductBundleGroup" (
          "id", "bundleId", "code", "name", "minimumSelections", "maximumSelections",
          "sortOrder", "createdAt", "updatedAt"
        ) VALUES (
          ${id}::uuid, ${bundleId}::uuid, ${normalized}, ${group.name.trim()},
          ${group.minimumSelections}, ${group.maximumSelections ?? null}, ${group.sortOrder},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
    }
    const seen = new Set<string>();
    for (const item of body.items) {
      const groupCode = item.groupCode
        ?.trim()
        .toUpperCase()
        .replace(/\s+/g, '-');
      const groupId = groupCode ? groupIds.get(groupCode) : undefined;
      if (groupCode && !groupId)
        throw new BadRequestException(`Grupo desconhecido: ${item.groupCode}.`);
      const key = `${item.productId}:${groupId ?? 'none'}`;
      if (seen.has(key))
        throw new BadRequestException(
          'Existem componentes duplicados no mesmo grupo.',
        );
      seen.add(key);
      await this.assertComponentProduct(tx, body.productId, item);
      await tx.$executeRaw`
        INSERT INTO "ProductBundleItem" (
          "id", "bundleId", "productId", "groupId", "quantity", "isRequired",
          "minimumQuantity", "maximumQuantity", "priceDeltaCents", "sortOrder", "isActive",
          "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${bundleId}::uuid, ${item.productId}::uuid, ${groupId ?? null}::uuid,
          ${item.quantity}, ${item.isRequired}, ${item.minimumQuantity}, ${item.maximumQuantity ?? null},
          ${item.priceDeltaCents}, ${item.sortOrder}, ${item.isActive}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
    }
    await this.upsertPersonalization(tx, body.productId, body.personalization);
  }

  private async assertComponentProduct(
    tx: Prisma.TransactionClient,
    bundleProductId: string,
    item: BundleItemDto,
  ) {
    if (item.productId === bundleProductId)
      throw new BadRequestException(
        'O cabaz não pode conter o próprio produto principal como componente.',
      );
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { id: true },
    });
    if (!product)
      throw new NotFoundException('Produto componente não encontrado.');
  }

  private async upsertPersonalization(
    tx: Prisma.TransactionClient,
    productId: string,
    config?: PersonalizationConfigDto,
  ) {
    if (!config) {
      await tx.$executeRaw`DELETE FROM "ProductPersonalization" WHERE "productId" = ${productId}::uuid`;
      return;
    }
    await tx.$executeRaw`
      INSERT INTO "ProductPersonalization" (
        "id", "productId", "allowGiftMessage", "allowRecipientName", "allowSpecialPackaging",
        "specialPackagingCents", "allowRequestedDate", "allowNotes", "allowHidePrice",
        "messageMaxLength", "notesMaxLength", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}::uuid, ${productId}::uuid, ${config.allowGiftMessage}, ${config.allowRecipientName},
        ${config.allowSpecialPackaging}, ${config.specialPackagingCents}, ${config.allowRequestedDate},
        ${config.allowNotes}, ${config.allowHidePrice}, ${config.messageMaxLength}, ${config.notesMaxLength},
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("productId") DO UPDATE SET
        "allowGiftMessage" = EXCLUDED."allowGiftMessage",
        "allowRecipientName" = EXCLUDED."allowRecipientName",
        "allowSpecialPackaging" = EXCLUDED."allowSpecialPackaging",
        "specialPackagingCents" = EXCLUDED."specialPackagingCents",
        "allowRequestedDate" = EXCLUDED."allowRequestedDate",
        "allowNotes" = EXCLUDED."allowNotes",
        "allowHidePrice" = EXCLUDED."allowHidePrice",
        "messageMaxLength" = EXCLUDED."messageMaxLength",
        "notesMaxLength" = EXCLUDED."notesMaxLength",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  }

  private validateDefinition(body: BundleUpsertDto) {
    if (
      body.minimumSelections !== undefined &&
      body.maximumSelections !== undefined &&
      body.maximumSelections < body.minimumSelections
    ) {
      throw new BadRequestException(
        'O máximo de escolhas não pode ser inferior ao mínimo.',
      );
    }
    if (body.mode === BundleModeDtoValue.FIXED && !body.items.length)
      throw new BadRequestException(
        'Um cabaz fixo precisa de pelo menos um componente.',
      );
    if (body.mode === BundleModeDtoValue.CONFIGURABLE && !body.items.length)
      throw new BadRequestException('Um cabaz configurável precisa de opções.');
  }
}
