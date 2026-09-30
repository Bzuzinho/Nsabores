import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import type { InviteUserDto, UpdateUserAdminDto, UsersQueryDto } from './dto';
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
      role: query.role ? query.role : { in: [UserRole.STAFF, UserRole.ADMIN] },
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
      where: {
        id,
        deletedAt: null,
        role: { in: [UserRole.STAFF, UserRole.ADMIN] },
      },
      select: {
        ...adminUser,
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
      },
    });
    if (!user) throw new NotFoundException('Utilizador não encontrado.');
    return {
      ...user,
      stats: { activeSessions: user.authSessions.length },
    };
  }

  async update(actorId: string, id: string, data: UpdateUserAdminDto) {
    const target = await this.getInternalUser(id);

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
    const target = await this.getInternalUser(id);
    await this.assertAdminContinuity(target, UserRole.STAFF, false);

    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: deletedAt },
      });
      await tx.businessAccount.updateMany({
        where: { managerId: id },
        data: { managerId: null },
      });
      await tx.supportCase.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null },
      });
      await tx.user.update({
        where: { id },
        data: {
          email: `deleted+${id}@deleted.invalid`,
          passwordHash: await argon2.hash(randomBytes(48).toString('hex')),
          firstName: 'Utilizador',
          lastName: 'Removido',
          phone: null,
          role: UserRole.STAFF,
          isActive: false,
          emailVerifiedAt: null,
          lastLoginAt: null,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          deletedAt,
        },
      });
    });

    return { success: true };
  }

  async sendPasswordReset(id: string) {
    const user = await this.getInternalUser(id);
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
    await this.getInternalUser(userId);
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  private async getInternalUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        role: { in: [UserRole.STAFF, UserRole.ADMIN] },
      },
      select: adminUser,
    });
    if (!user) throw new NotFoundException('Utilizador não encontrado.');
    return user;
  }

  private async assertAdminContinuity(
    target: Awaited<ReturnType<AdminUsersService['getInternalUser']>>,
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
