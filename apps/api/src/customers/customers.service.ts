import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { AddressDto, UpdateAddressDto } from '../auth/dto';
import type {
  CreateCustomerDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from './dto';

const customerSelect = {
  id: true,
  userId: true,
  type: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  taxNumber: true,
  marketingConsent: true,
  marketingConsentAt: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      isActive: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
    },
  },
  _count: { select: { orders: true, addresses: true } },
} as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CustomerQueryDto) {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(query.search?.trim()
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: 'insensitive' } },
              { email: { contains: query.search.trim(), mode: 'insensitive' } },
              { phone: { contains: query.search.trim(), mode: 'insensitive' } },
              {
                company: { contains: query.search.trim(), mode: 'insensitive' },
              },
              {
                taxNumber: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: customerSelect,
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async detail(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...customerSelect,
        addresses: {
          orderBy: [
            { isDefaultShipping: 'desc' },
            { isDefaultBilling: 'desc' },
            { createdAt: 'desc' },
          ],
        },
      },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');

    const [orderValue, recentOrders, supportCases, newsletter] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: {
            customerId: id,
            status: {
              notIn: [
                OrderStatus.CANCELLED,
                OrderStatus.REJECTED,
                OrderStatus.REFUNDED,
              ],
            },
          },
          _sum: { totalCents: true },
        }),
        this.prisma.order.findMany({
          where: { customerId: id },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: {
            id: true,
            number: true,
            status: true,
            paymentStatus: true,
            totalCents: true,
            createdAt: true,
          },
        }),
        this.prisma.supportCase.count({
          where: {
            OR: [
              ...(customer.userId ? [{ userId: customer.userId }] : []),
              { order: { customerId: id } },
            ],
          },
        }),
        this.prisma.newsletterSubscription.findUnique({
          where: { email: customer.email },
          select: { isActive: true, consentedAt: true },
        }),
      ]);

    return {
      ...customer,
      stats: {
        orders: customer._count.orders,
        orderValueCents: orderValue._sum.totalCents ?? 0,
        addresses: customer._count.addresses,
        supportCases,
      },
      recentOrders,
      newsletter,
    };
  }

  async create(body: CreateCustomerDto) {
    const email = body.email.trim().toLowerCase();
    const existing = await this.prisma.customer.findUnique({
      where: { email },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('Já existe um cliente com este email.');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        role: UserRole.CUSTOMER,
        deletedAt: null,
      },
      select: { id: true },
    });
    const consentAt = body.marketingConsent ? new Date() : null;

    if (existing?.deletedAt) {
      return this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          userId: user?.id ?? null,
          type: body.type,
          name: body.name.trim(),
          email,
          phone: body.phone?.trim() || null,
          company: body.company?.trim() || null,
          taxNumber: body.taxNumber?.trim() || null,
          marketingConsent: body.marketingConsent ?? false,
          marketingConsentAt: consentAt,
          notes: body.notes?.trim() || null,
          isActive: true,
          deletedAt: null,
        },
        select: customerSelect,
      });
    }

    return this.prisma.customer.create({
      data: {
        userId: user?.id,
        type: body.type,
        name: body.name.trim(),
        email,
        phone: body.phone?.trim() || null,
        company: body.company?.trim() || null,
        taxNumber: body.taxNumber?.trim() || null,
        marketingConsent: body.marketingConsent ?? false,
        marketingConsentAt: consentAt,
        notes: body.notes?.trim() || null,
      },
      select: customerSelect,
    });
  }

  async update(id: string, body: UpdateCustomerDto) {
    const customer = await this.get(id);
    const consentAt =
      body.marketingConsent === true && !customer.marketingConsent
        ? new Date()
        : body.marketingConsent === false
          ? null
          : undefined;
    try {
      return await this.prisma.customer.update({
        where: { id },
        data: {
          type: body.type,
          name: body.name?.trim(),
          email: body.email?.trim().toLowerCase(),
          phone:
            body.phone === undefined ? undefined : body.phone?.trim() || null,
          company:
            body.company === undefined
              ? undefined
              : body.company?.trim() || null,
          taxNumber:
            body.taxNumber === undefined
              ? undefined
              : body.taxNumber?.trim() || null,
          marketingConsent: body.marketingConsent,
          marketingConsentAt: consentAt,
          notes:
            body.notes === undefined ? undefined : body.notes?.trim() || null,
          isActive: body.isActive,
        },
        select: customerSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um cliente com este email.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const customer = await this.get(id);
    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.address.deleteMany({ where: { customerId: id } });
      await tx.newsletterSubscription.updateMany({
        where: { email: customer.email },
        data: { isActive: false },
      });
      await tx.customer.update({
        where: { id },
        data: {
          userId: null,
          name: 'Cliente removido',
          email: `deleted+${id}@deleted.invalid`,
          phone: null,
          company: null,
          taxNumber: null,
          marketingConsent: false,
          marketingConsentAt: null,
          notes: null,
          isActive: false,
          deletedAt,
        },
      });
    });
    return {
      success: true,
      message:
        'Cliente removido. O histórico comercial foi preservado de forma anonimizada.',
    };
  }

  async createAddress(customerId: string, body: AddressDto) {
    const customer = await this.get(customerId);
    return this.prisma.$transaction(async (tx) => {
      if (body.isDefaultShipping) {
        await tx.address.updateMany({
          where: { customerId, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }
      if (body.isDefaultBilling) {
        await tx.address.updateMany({
          where: { customerId, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }
      return tx.address.create({
        data: {
          ...body,
          customerId,
          userId: customer.userId ?? undefined,
        },
      });
    });
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    body: UpdateAddressDto,
  ) {
    await this.get(customerId);
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address) throw new NotFoundException('Morada não encontrada.');
    return this.prisma.$transaction(async (tx) => {
      if (body.isDefaultShipping) {
        await tx.address.updateMany({
          where: {
            customerId,
            isDefaultShipping: true,
            id: { not: addressId },
          },
          data: { isDefaultShipping: false },
        });
      }
      if (body.isDefaultBilling) {
        await tx.address.updateMany({
          where: {
            customerId,
            isDefaultBilling: true,
            id: { not: addressId },
          },
          data: { isDefaultBilling: false },
        });
      }
      return tx.address.update({ where: { id: addressId }, data: body });
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    await this.get(customerId);
    const result = await this.prisma.address.deleteMany({
      where: { id: addressId, customerId },
    });
    if (!result.count) throw new NotFoundException('Morada não encontrada.');
    return { success: true };
  }

  private async get(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    return customer;
  }
}
