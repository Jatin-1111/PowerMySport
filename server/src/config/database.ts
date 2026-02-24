import mongoose from "mongoose";

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
        console.log("✅ MongoDB connected successfully");
      });

      mongoose.connection.on("error", (err) => {
        console.error("❌ MongoDB connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        console.warn("⚠️ MongoDB disconnected");
      });

      if (!process.env.VERCEL) {
        process.on("SIGINT", async () => {
          await mongoose.connection.close();
          console.log("🛑 MongoDB connection closed due to app termination");
          process.exit(0);
        });
      }

      isListenersAttached = true;
    }

    connectionPromise = mongoose.connect(mongoUri, options);
    await connectionPromise;
    connectionPromise = null;

    // Log connection pool stats on startup
    console.log(
      `🔌 Database Pool initialized: Min ${options.minPoolSize} / Max ${options.maxPoolSize} connections`,
    );
  } catch (error) {
    connectionPromise = null;
    console.error("❌ MongoDB connection failed:", error);
    throw error;
  }
};

export default mongoose;
