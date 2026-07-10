import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Single shared PrismaClient instance for the whole server process.
 *
 * Prisma manages its own connection pool internally (configured via the
 * `connection_limit` query parameter on DATABASE_URL — see .env.example), so
 * unlike Mongoose we never open more than one client. The instance is cached on
 * `globalThis` so `ts-node`/nodemon hot-reloads in dev don't leak clients.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const logLevels: Prisma.LogLevel[] =
  process.env.NODE_ENV === "production"
    ? ["error", "warn"]
    : ["error", "warn"];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { Prisma };
export default prisma;
