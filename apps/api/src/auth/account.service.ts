import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { AddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  addresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async dashboard(userId: string) {
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
      this.prisma.order.count({ where: { userId } }),
      this.prisma.order.count({
        where: {
          userId,
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
        where: { userId },
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
      this.prisma.address.count({ where: { userId } }),
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
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefaultShipping) {
        await tx.address.updateMany({
          where: { userId, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }
      if (data.isDefaultBilling) {
        await tx.address.updateMany({
          where: { userId, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }
      return tx.address.create({ data: { ...data, userId } });
    });
  }

  async updateAddress(userId: string, id: string, data: UpdateAddressDto) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });
    if (!address) throw new NotFoundException('Morada não encontrada.');
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefaultShipping) {
        await tx.address.updateMany({
          where: { userId, isDefaultShipping: true, id: { not: id } },
          data: { isDefaultShipping: false },
        });
      }
      if (data.isDefaultBilling) {
        await tx.address.updateMany({
          where: { userId, isDefaultBilling: true, id: { not: id } },
          data: { isDefaultBilling: false },
        });
      }
      return tx.address.update({ where: { id }, data });
    });
  }

  async deleteAddress(userId: string, id: string) {
    const result = await this.prisma.address.deleteMany({
      where: { id, userId },
    });
    if (!result.count) throw new NotFoundException('Morada não encontrada.');
    return { success: true };
  }
}
