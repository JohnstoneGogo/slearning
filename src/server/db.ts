import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma: PrismaClient =
  g.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;
