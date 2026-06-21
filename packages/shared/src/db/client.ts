/** Prisma (Mongo) singleton. Reused across hot-reloads in dev and by the keeper. */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { keelPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.keelPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.keelPrisma = prisma;
}

export * from "@prisma/client";
