import argon2 from 'argon2';
import { PrismaService } from './prisma.service';

export async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) return;

  const prisma = new PrismaService();
  try {
    const passwordHash = await argon2.hash(password);
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
