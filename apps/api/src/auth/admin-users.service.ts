import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { UpdateUserAdminDto, UsersQueryDto } from './dto';

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
  customerProfile: {
    select: {
      taxNumber: true,
      marketingConsent: true,
      notes: true,
    },
  },
} as const;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: UsersQueryDto) {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const where: Prisma.UserWhereInput = {
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
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: adminUser,
        orderBy: { createdAt: 'desc' },
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...adminUser,
        addresses: true,
        authSessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: {
            id: true,
            userAgent: true,
            ipAddress: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Utilizador não encontrado.');
    return user;
  }

  async update(actorId: string, id: string, data: UpdateUserAdminDto) {
    if (
      actorId === id &&
      (data.isActive === false || data.role !== undefined)
    ) {
      throw new ForbiddenException(
        'Não pode remover o próprio acesso administrativo.',
      );
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        role: data.role,
        isActive: data.isActive,
        customerProfile:
          data.notes === undefined
            ? undefined
            : {
                upsert: {
                  create: { notes: data.notes },
                  update: { notes: data.notes },
                },
              },
      },
      select: adminUser,
    });
  }

  async revokeSessions(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
