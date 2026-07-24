import { Injectable, NotFoundException } from '@nestjs/common';
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
