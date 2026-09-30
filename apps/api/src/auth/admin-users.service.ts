import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import type {
  AddressDto,
  InviteUserDto,
  UpdateAddressDto,
  UpdateUserAdminDto,
  UsersQueryDto,
} from './dto';
import { MailProvider } from './mail.provider';

const adminUser = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  customerProfile: {
    select: {
      taxNumber: true,
      marketingConsent: true,
      marketingConsentAt: true,
      notes: true,
    },
  },
} as const;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailProvider,
  ) {}

  async invite(body: InviteUserDto) {
    const email = body.email.trim().toLowerCase();
    if (
      await this.prisma.user.findFirst({
        where: { email, deletedAt: null },
        select: { id: true },
      })
    ) {
      throw new ConflictException('Já existe um utilizador com este email.');
    }

    const token = randomBytes(32).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        role: body.role,
        phone: body.phone?.trim() || null,
        passwordHash: await argon2.hash(randomBytes(32).toString('hex')),
        passwordResetTokenHash: createHash('sha256')
          .update(token)
          .digest('hex'),
        passwordResetExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        emailVerifiedAt: new Date(),
        customerProfile: {
          create: {
            taxNumber: body.taxNumber?.trim() || null,
          },
        },
      },
      select: adminUser,
    });
    this.mail.sendPasswordReset(email, token);
    return user;
  }

  async list(query: UsersQueryDto) {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.active === undefined ? {} : { isActive: query.active }),
      ...(query.search?.trim()
        ? {
            OR: [
              { email: { contains: query.search.trim(), mode: 'insensitive' } },
              {
                firstName: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: adminUser,
        orderBy: [{ role: 'asc' }, { firstName: 'asc' }, { lastName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...adminUser,
        addresses: {
          orderBy: [
            { isDefaultShipping: 'desc' },
            { isDefaultBilling: 'desc' },
            { createdAt: 'desc' },
          ],
        },
        authSessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: {
            id: true,
            userAgent: true,
            ipAddress: true,
            createdAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        businessMemberships: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            businessAccount: {
              select: {
                id: true,
                type: true,
                tradeName: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Utilizador não encontrado.');

    const [orderCount, orderValue, recentOrders, supportCases, newsletter] =
      await Promise.all([
        this.prisma.order.count({ where: { userId: id } }),
        this.prisma.order.aggregate({
          where: {
            userId: id,
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
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          take: 8,
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
            OR: [{ userId: id }, { assignedToId: id }],
          },
        }),
        this.prisma.newsletterSubscription.findUnique({
          where: { email: user.email },
          select: { isActive: true, consentedAt: true },
        }),
      ]);

    return {
      ...user,
      stats: {
        orders: orderCount,
        orderValueCents: orderValue._sum.totalCents ?? 0,
        addresses: user.addresses.length,
        activeSessions: user.authSessions.length,
        supportCases,
      },
      recentOrders,
      newsletter,
    };
  }

  async update(actorId: string, id: string, data: UpdateUserAdminDto) {
    const target = await this.getActiveUser(id);

    if (
      actorId === id &&
      (data.isActive === false ||
        (data.role !== undefined && data.role !== target.role))
    ) {
      throw new ForbiddenException(
        'Não pode remover ou reduzir o próprio acesso administrativo.',
      );
    }

    await this.assertAdminContinuity(target, data.role, data.isActive);

    const previousConsent = target.customerProfile?.marketingConsent ?? false;
    const consentAt =
      data.marketingConsent === true && !previousConsent
        ? new Date()
        : data.marketingConsent === false
          ? null
          : undefined;

    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          email: data.email?.trim().toLowerCase(),
          firstName: data.firstName?.trim(),
          lastName: data.lastName?.trim(),
          phone:
            data.phone === undefined ? undefined : data.phone?.trim() || null,
          role: data.role,
          isActive: data.isActive,
          customerProfile: {
            upsert: {
              create: {
                taxNumber: data.taxNumber?.trim() || null,
                marketingConsent: data.marketingConsent ?? false,
                marketingConsentAt: consentAt,
                notes: data.notes?.trim() || null,
              },
              update: {
                taxNumber:
                  data.taxNumber === undefined
                    ? undefined
                    : data.taxNumber?.trim() || null,
                marketingConsent: data.marketingConsent,
                marketingConsentAt: consentAt,
                notes:
                  data.notes === undefined
                    ? undefined
                    : data.notes?.trim() || null,
              },
            },
          },
        },
        select: adminUser,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma conta com este email.');
      }
      throw error;
    }
  }

  async remove(actorId: string, id: string) {
    if (actorId === id) {
      throw new ForbiddenException('Não pode apagar a própria conta.');
    }
    const target = await this.getActiveUser(id);
    await this.assertAdminContinuity(target, UserRole.CUSTOMER, false);

    const deletedEmail = `deleted+${id}@deleted.invalid`;
    const unusablePassword = await argon2.hash(randomBytes(48).toString('hex'));
    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: deletedAt },
      });
      await tx.address.deleteMany({ where: { userId: id } });
      await tx.cart.deleteMany({ where: { userId: id } });
      await tx.businessAccountUser.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });
      await tx.businessAccount.updateMany({
        where: { managerId: id },
        data: { managerId: null },
      });
      await tx.supportCase.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null },
      });
      await tx.newsletterSubscription.updateMany({
        where: { email: target.email },
        data: { isActive: false },
      });
      await tx.user.update({
        where: { id },
        data: {
          email: deletedEmail,
          passwordHash: unusablePassword,
          firstName: 'Utilizador',
          lastName: 'Removido',
          phone: null,
          role: UserRole.CUSTOMER,
          isActive: false,
          emailVerifiedAt: null,
          lastLoginAt: null,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          deletedAt,
          customerProfile: {
            upsert: {
              create: {
                taxNumber: null,
                marketingConsent: false,
                marketingConsentAt: null,
                notes: null,
              },
              update: {
                taxNumber: null,
                marketingConsent: false,
                marketingConsentAt: null,
                notes: null,
              },
            },
          },
        },
      });
    });

    return {
      success: true,
      message:
        'Conta removida. O histórico comercial foi preservado sem os dados pessoais da conta.',
    };
  }

  async sendPasswordReset(id: string) {
    const user = await this.getActiveUser(id);
    if (!user.isActive) {
      throw new ConflictException('A conta está inativa.');
    }
    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordResetTokenHash: createHash('sha256')
          .update(token)
          .digest('hex'),
        passwordResetExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });
    this.mail.sendPasswordReset(user.email, token);
    return { success: true };
  }

  async revokeSessions(userId: string) {
    await this.getActiveUser(userId);
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async createAddress(userId: string, data: AddressDto) {
    await this.getActiveUser(userId);
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

  async updateAddress(
    userId: string,
    addressId: string,
    data: UpdateAddressDto,
  ) {
    await this.getActiveUser(userId);
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Morada não encontrada.');

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefaultShipping) {
        await tx.address.updateMany({
          where: {
            userId,
            isDefaultShipping: true,
            id: { not: addressId },
          },
          data: { isDefaultShipping: false },
        });
      }
      if (data.isDefaultBilling) {
        await tx.address.updateMany({
          where: {
            userId,
            isDefaultBilling: true,
            id: { not: addressId },
          },
          data: { isDefaultBilling: false },
        });
      }
      return tx.address.update({ where: { id: addressId }, data });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.getActiveUser(userId);
    const result = await this.prisma.address.deleteMany({
      where: { id: addressId, userId },
    });
    if (!result.count) throw new NotFoundException('Morada não encontrada.');
    return { success: true };
  }

  private async getActiveUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: adminUser,
    });
    if (!user) throw new NotFoundException('Utilizador não encontrado.');
    return user;
  }

  private async assertAdminContinuity(
    target: Awaited<ReturnType<AdminUsersService['getActiveUser']>>,
    nextRole: UserRole | undefined,
    nextActive: boolean | undefined,
  ) {
    if (
      target.role !== UserRole.ADMIN ||
      !target.isActive ||
      ((nextRole === undefined || nextRole === UserRole.ADMIN) &&
        nextActive !== false)
    ) {
      return;
    }

    const activeAdmins = await this.prisma.user.count({
      where: {
        role: UserRole.ADMIN,
        isActive: true,
        deletedAt: null,
      },
    });
    if (activeAdmins <= 1) {
      throw new ForbiddenException(
        'Tem de existir pelo menos um administrador ativo.',
      );
    }
  }
}
