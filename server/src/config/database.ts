import mongoose from "mongoose";
import { bootFact } from "../utils/boot";
import { log as __rootLog } from "../utils/logger";
const log = __rootLog.child("database");

let isListenersAttached = false;
let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }

    if (connectionPromise) {
      await connectionPromise;
      return;
    }

    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/powermysport";

    // Mongoose connection options for pooling and reliability
    const options = {
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || "10", 10), // Maintain up to 10 socket connections
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || "2", 10), // Keep at least 2 socket connections
      maxIdleTimeMS: 30000, // Close sockets after 30 seconds of inactivity
      serverSelectionTimeoutMS: 30000, // Default to 30s to avoid premature timeouts
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    if (!isListenersAttached) {
      mongoose.connection.on("connected", () => {
        bootFact("mongo", "connected");
      });

      mongoose.connection.on("error", (err) => {
        log.error("MongoDB connection error", { err: err?.message || err });
      });

      mongoose.connection.on("disconnected", () => {
        log.warn("MongoDB disconnected");
      });

      if (!process.env.VERCEL) {
        process.on("SIGINT", async () => {
          await mongoose.connection.close();
          log.info("MongoDB connection closed due to app termination");
          process.exit(0);
        });
      }

      isListenersAttached = true;
    }

    connectionPromise = mongoose.connect(mongoUri, options);
    await connectionPromise;
    connectionPromise = null;

    // Log connection pool stats on startup
    bootFact(
      "mongo",
      `pool ${options.minPoolSize}–${options.maxPoolSize}`,
    );

    // Drop the old unique index on RoadmapChatSession so multiple sessions per
    // user+sport are allowed. Safe to call repeatedly — errors are ignored.
    try {
      await mongoose.connection.db
        ?.collection("roadmapchatsessions")
        .dropIndex("userId_1_sportSlug_1");
      // Index dropped (or was never there) — not worth a boot line either way.
    } catch {
      // Index already dropped or never existed — fine
    }
  } catch (error) {
    connectionPromise = null;
    log.error("MongoDB connection failed:", error);
    throw error;
  }
};

export default mongoose;
