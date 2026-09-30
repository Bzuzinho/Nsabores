import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { AddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async addresses(userId: string) {
    const customer = await this.customerForUser(userId);
    return this.prisma.address.findMany({
      where: customer ? { customerId: customer.id } : { userId },
      orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async dashboard(userId: string) {
    const customer = await this.customerForUser(userId);
    const orderWhere = customer ? { customerId: customer.id } : { userId };
    const addressWhere = customer ? { customerId: customer.id } : { userId };

    const [
      totalOrders,
      activeOrders,
      recentOrders,
      addressCount,
      documents,
      membership,
      subscription,
      loyalty,
    ] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.count({
        where: {
          ...orderWhere,
          status: {
            notIn: [
              OrderStatus.DELIVERED,
              OrderStatus.CANCELLED,
              OrderStatus.REFUNDED,
            ],
          },
        },
      }),
      this.prisma.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          number: true,
          status: true,
          totalCents: true,
          createdAt: true,
        },
      }),
      this.prisma.address.count({ where: addressWhere }),
      this.prisma.fiscalDocument.count({ where: { customerUserId: userId } }),
      this.prisma.businessAccountUser.findFirst({
        where: { userId, isActive: true },
        include: {
          businessAccount: {
            select: {
              id: true,
              type: true,
              tradeName: true,
              status: true,
              priceList: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.clubSubscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loyaltyAccount.findUnique({ where: { userId } }),
    ]);

    const business = membership?.businessAccount;
    const planSnapshot = subscription?.planSnapshot;
    const planName =
      planSnapshot &&
      typeof planSnapshot === 'object' &&
      !Array.isArray(planSnapshot) &&
      'name' in planSnapshot &&
      typeof planSnapshot.name === 'string'
        ? planSnapshot.name
        : null;

    return {
      accountType: !business
        ? 'PARTICULAR'
        : business.type === 'RESELLER'
          ? 'RESELLER'
          : 'B2B',
      businessAccount: business
        ? {
            id: business.id,
            type: business.type,
            tradeName: business.tradeName,
            status: business.status,
            priceListName: business.priceList?.name ?? null,
          }
        : null,
      orders: {
        total: totalOrders,
        active: activeOrders,
        recent: recentOrders,
      },
      addresses: addressCount,
      documents,
      club: {
        active: Boolean(
          subscription &&
          ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(subscription.status),
        ),
        status: subscription?.status ?? null,
        planName,
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      },
      loyalty: {
        availablePoints: loyalty?.availablePoints ?? 0,
        pendingPoints: loyalty?.pendingPoints ?? 0,
      },
    };
  }

  async createAddress(userId: string, data: AddressDto) {
    const customer = await this.customerForUser(userId);
    return this.prisma.$transaction(async (tx) => {
      const where = customer ? { customerId: customer.id } : { userId };
      if (data.isDefaultShipping) {
        await tx.address.updateMany({
          where: { ...where, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }
      if (data.isDefaultBilling) {
        await tx.address.updateMany({
          where: { ...where, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }
      return tx.address.create({
        data: {
          ...data,
          userId,
          customerId: customer?.id,
        },
      });
    });
  }

  async updateAddress(userId: string, id: string, data: UpdateAddressDto) {
    const customer = await this.customerForUser(userId);
    const ownerWhere = customer ? { customerId: customer.id } : { userId };
    const address = await this.prisma.address.findFirst({
      where: { id, ...ownerWhere },
    });
    if (!address) throw new NotFoundException('Morada não encontrada.');

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefaultShipping) {
        await tx.address.updateMany({
          where: {
            ...ownerWhere,
            isDefaultShipping: true,
            id: { not: id },
          },
          data: { isDefaultShipping: false },
        });
      }
      if (data.isDefaultBilling) {
        await tx.address.updateMany({
          where: {
            ...ownerWhere,
            isDefaultBilling: true,
            id: { not: id },
          },
          data: { isDefaultBilling: false },
        });
      }
      return tx.address.update({ where: { id }, data });
    });
  }

  async deleteAddress(userId: string, id: string) {
    const customer = await this.customerForUser(userId);
    const result = await this.prisma.address.deleteMany({
      where: customer ? { id, customerId: customer.id } : { id, userId },
    });
    if (!result.count) throw new NotFoundException('Morada não encontrada.');
    return { success: true };
  }

  private customerForUser(userId: string) {
    return this.prisma.customer.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
  }
}
