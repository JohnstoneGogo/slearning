import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  g.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 1,
    }),
  });

// Reuse the same client + pool across warm serverless invocations in all environments.
g.prisma = prisma;

export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;
