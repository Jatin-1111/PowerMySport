import prisma from "../lib/prisma";

/**
 * PostgreSQL / Prisma replacement for the old Mongoose connection module.
 *
 * The public surface (`connectDB`, default export) is kept identical to the
 * Mongo version so `server.ts` and any callers do not need to change: they
 * still `import mongoose from "../config/database"` → now they get the Prisma
 * client, and `await connectDB()` still establishes/validates the connection.
 *
 * Prisma connects lazily on first query, but we call `$connect()` up front so a
 * bad DATABASE_URL fails fast on boot (matching the old fail-fast behavior).
 */

let isConnected = false;
let listenersAttached = false;

export const connectDB = async (): Promise<void> => {
  try {
    if (isConnected) return;

    await prisma.$connect();
    isConnected = true;

    if (!listenersAttached) {
      if (!process.env.VERCEL) {
        const shutdown = async () => {
          await prisma.$disconnect();
          console.log("🛑 PostgreSQL connection closed due to app termination");
          process.exit(0);
        };
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
      }
      listenersAttached = true;
    }

    console.log("✅ PostgreSQL (Prisma) connected successfully");
  } catch (error) {
    isConnected = false;
    console.error("❌ PostgreSQL connection failed:", error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (!isConnected) return;
  await prisma.$disconnect();
  isConnected = false;
};

// Default export mirrors the old `export default mongoose` so existing
// `import mongoose from "../config/database"` sites resolve to the Prisma client.
export default prisma;
