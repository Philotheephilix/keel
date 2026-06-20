/** Prisma (Mongo) singleton. Reused across hot-reloads in dev and by the keeper. */
import { PrismaClient } from "./generated/index.js";

const globalForPrisma = globalThis as unknown as { keelPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.keelPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.keelPrisma = prisma;
}

export * from "./generated/index.js";
