import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config
      .get<string>('BOOTSTRAP_ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();
    const passwordHash = this.config.get<string>(
      'BOOTSTRAP_ADMIN_PASSWORD_HASH',
    );

    if (!email && !passwordHash) return;
    if (!email || !passwordHash) {
      throw new Error(
        'BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD_HASH têm de ser definidos em conjunto.',
      );
    }

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
      create: {
        email,
        passwordHash,
        firstName: 'Administrador',
        lastName: 'Nsabores',
        role: 'ADMIN',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      select: {
        email: true,
        role: true,
        isActive: true,
      },
    });

    console.log(`Admin bootstrap completed for ${user.email} (${user.role}).`);
  }
}
