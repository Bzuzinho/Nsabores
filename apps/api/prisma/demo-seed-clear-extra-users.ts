import { db, prisma } from './demo-shared';

const extraDemoEmails = [
  'demo.admin@nsabores.pt',
  'demo.operacoes@nsabores.pt',
  'demo.revendedor@nsabores.pt',
] as const;

async function main() {
  const users = await db.user.findMany({
    where: { email: { in: [...extraDemoEmails] } },
    select: { id: true },
  });
  const userIds = users.map((user: any) => user.id);

  if (!userIds.length) {
    console.log('Sem utilizadores demo avançados para remover.');
    return;
  }

  await db.businessAccountUser.deleteMany({ where: { userId: { in: userIds } } });
  await db.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await db.address.deleteMany({ where: { userId: { in: userIds } } });
  await db.customerProfile.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });

  console.log(`Removidos ${userIds.length} utilizadores demo avançados.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
