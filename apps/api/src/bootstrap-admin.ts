import { PrismaService } from './prisma.service';

export async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH;

  if (!email || !passwordHash) return;

  const prisma = new PrismaService();
  try {
    const user = await prisma.user.upsert({
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
      },
      select: {
        email: true,
        role: true,
        isActive: true,
      },
    });

    console.log(`Admin bootstrap completed for ${user.email} (${user.role}).`);
  } finally {
    await prisma.$disconnect();
  }
}
