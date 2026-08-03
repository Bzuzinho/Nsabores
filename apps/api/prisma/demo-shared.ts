import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/nsabores';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

export const db = prisma as any;
export const DEMO_SOURCE = 'DEMO_SEED';
export const now = new Date();
export const day = (offset: number) =>
  new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);

export const demoProductSkus = [
  'COMP-ABO-NOZ',
  'MEL-MULTI',
  'AZE-VIRGEM',
  'ENC-PRESUNTO',
  'ENC-SALPICAO',
  'QUE-CABRA',
  'QUE-OVELHA',
  'VIN-BRANCO',
  'VIN-ESPUMANTE',
  'TAB-ESSENCIAL',
  'TAB-CELEBRACAO',
  'CAB-PORTUGAL',
] as const;

export const demoEmails = [
  'demo.admin@nsabores.pt',
  'demo.staff@nsabores.pt',
  'demo.operacoes@nsabores.pt',
  'demo.revendedor@nsabores.pt',
  'demo.cliente1@nsabores.pt',
  'demo.cliente2@nsabores.pt',
  'demo.cliente3@nsabores.pt',
  'demo.cliente4@nsabores.pt',
  'demo.cliente5@nsabores.pt',
] as const;

export function demoAddress(name: string, company?: string) {
  return {
    firstName: name,
    lastName: 'Demonstração',
    company,
    taxNumber: company ? '509999990' : undefined,
    line1: 'Rua da Demonstração, 10',
    postalCode: '2460-000',
    city: 'Alcobaça',
    countryCode: 'PT',
    phone: '+351 910 000 000',
  };
}

export async function demoPasswordHash() {
  const password = process.env.DEMO_USER_PASSWORD;
  const configured =
    process.env.DEMO_USER_PASSWORD_HASH ??
    process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH;

  if (password) return argon2.hash(password, { type: argon2.argon2id });
  if (configured) return configured;
  throw new Error(
    'Defina DEMO_USER_PASSWORD, DEMO_USER_PASSWORD_HASH ou BOOTSTRAP_ADMIN_PASSWORD_HASH.',
  );
}

export async function findOrCreate(
  delegate: any,
  where: Record<string, unknown>,
  create: Record<string, unknown>,
  update: Record<string, unknown> = create,
) {
  const existing = await delegate.findFirst({ where });
  if (existing) {
    return delegate.update({ where: { id: existing.id }, data: update });
  }
  return delegate.create({ data: create });
}

export async function requiredUser(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Utilizador demo em falta: ${email}`);
  return user;
}

export async function requiredProduct(sku: string) {
  const product = await db.product.findUnique({ where: { sku } });
  if (!product) throw new Error(`Produto demo em falta: ${sku}`);
  return product;
}

export async function requiredOrder(number: string) {
  const order = await db.order.findUnique({ where: { number } });
  if (!order) throw new Error(`Encomenda demo em falta: ${number}`);
  return order;
}
