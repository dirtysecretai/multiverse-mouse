import { PrismaClient } from '@prisma/client';

// Prisma Client singleton to avoid multiple instances
const globalForPrisma = global as unknown as { prisma: PrismaClient; prismaDirectDb: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Direct database client — bypasses Prisma Accelerate's 5 MB response-size limit.
 * Use this for queries that may return large JSON payloads (e.g. canvas layers
 * containing base64 image data).
 */
export const prismaDirectDb: PrismaClient =
  globalForPrisma.prismaDirectDb ||
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaDirectDb = prismaDirectDb;

export default prisma;
