import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import app from "./app";
import { createRedisPubSub } from "./config/redis";
import { connectDB } from "./config/database";
import { setupCommunitySocket } from "./community/sockets/communitySocket";
import {
  setupFriendSocket,
  setFriendSocketInstance,
} from "./client/sockets/friendSocket";
import {
  setupNotificationSocket,
  setupPresenceSocket,
} from "./client/sockets/notificationSocket";
import {
  setupBookingSocket,
  setBookingSocketInstance,
} from "./client/sockets/bookingSocket";
import { setupInfraSocket } from "./admin/sockets/infraSocket";
import { setNotificationSocketInstance } from "./client/services/NotificationService";
import { setCommunityRealtimeSocketInstance } from "./community/services/CommunityRealtimeService";
import { startExpirationJob } from "./utils/timer";
import { initializeReminderScheduler } from "./utils/reminderScheduler";
import { startOutboxWorker } from "./shared/services/OutboxService";
import { initializeScraperScheduler } from "./utils/scraperScheduler";
import { initializeScheduledJobs } from "./utils/scheduledJobs";
const PORT = process.env.PORT || 5000;

let stopOutboxWorker: (() => void) | null = null;

const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/$/, "").toLowerCase();

const configuredOrigins = [
  process.env.FRONTEND_URLS,
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "https://powermysport.com",
  "https://client-uat.powermysport.com",
  "https://www.powermysport.com",
  "https://admin.powermysport.com",
  "https://community.powermysport.com",
]
  .filter(Boolean)
  .flatMap((value) => (value as string).split(","))
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins);
const allowedOriginPatterns = [
  /^https:\/\/([a-z0-9-]+\.)*powermysport\.com$/i,
  /^http:\/\/localhost:\d+$/i,
];

const isOriginAllowed = (origin: string): boolean => {
  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  return allowedOriginPatterns.some((pattern) =>
    pattern.test(normalizedOrigin),
  );
};

// Start server function
const startServer = async () => {
  try {
    // Connect to Database
    await connectDB();

    const httpServer = http.createServer(app);

    // Create ONE Socket.IO instance
    const io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || isOriginAllowed(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error("Origin not allowed"));
        },
        credentials: true,
        methods: ["GET", "POST"],
      },
    });

    // ── Redis adapter — makes Socket.IO rooms work across multiple instances ──
    // Clients are created here (not at module level) so any connection error
    // is fully caught by this try/catch and never crashes the process.
    let redisPub: ReturnType<typeof createRedisPubSub>["pub"] | null = null;
    let redisSub: ReturnType<typeof createRedisPubSub>["sub"] | null = null;
    try {
      const { pub, sub } = createRedisPubSub();
      await Promise.all([pub.connect(), sub.connect()]);
      io.adapter(createAdapter(pub, sub));
      redisPub = pub;
      redisSub = sub;
      console.log(
        "🔴 Redis adapter attached to Socket.IO (multi-instance mode)",
      );
    } catch {
      console.warn(
        "⚠️  Redis unavailable — running in single-instance mode (start Redis to enable horizontal scaling)",
      );
      // Stop ioredis retry loop — without this it floods the logs with
      // connection errors indefinitely even though we've fallen back to
      // single-instance mode.
      try {
        redisPub?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        redisSub?.disconnect();
      } catch {
        /* ignore */
      }
    }

    // Setup both socket handlers on the same instance
    setupCommunitySocket(io);
    setupFriendSocket(io);
    setupNotificationSocket(io);
    setupPresenceSocket(io);
    setupBookingSocket(io);
    setupInfraSocket(io);
    setFriendSocketInstance(io);
    setNotificationSocketInstance(io);
    setCommunityRealtimeSocketInstance(io);
    setBookingSocketInstance(io);

    console.log("🔧 Socket.IO namespaces configured:");
    console.log("   - /community (requires community profile)");
    console.log("   - /friends (basic auth)");
    console.log("   - /presence (user presence tracking)");
    console.log("   - /notifications (real-time monitoring)");
    console.log("   - /bookings (booking slot locks)");

    let server: http.Server | null = null;
    let attempts = 5;
    let jobsStarted = false;

    const startListening = (port: number) => {
      // Always create a fresh HTTP server for each attempt so we never call
      // .listen() twice on the same server object (which causes double startup).
      server = http.createServer(app);

      // Re-attach Socket.IO to the new server instance.
      io.attach(server);

      server.on("listening", () => {
        console.log(`\n✅ Server is running on http://localhost:${port}`);
        console.log(`💬 Community socket ready`);
        console.log(`👥 Friend socket ready`);
        console.log(`📝 API Documentation:`);

        // Guard: only start background jobs once, even if retried ports.
        if (!jobsStarted) {
          jobsStarted = true;

          // Scheduled cleanup jobs (moved from app.ts to here so they only
          // run after the server is confirmed listening).
          initializeScheduledJobs();

          // Start booking expiration job
          startExpirationJob();
          console.log(`⏰ Booking expiration job started`);

          // Start reminder scheduler
          initializeReminderScheduler();
          console.log(`🔔 Booking reminder scheduler started\n`);

          // Start outbox worker to handle message notification delivery and retries
          stopOutboxWorker = startOutboxWorker();
          console.log("📨 Outbox worker started");

          // Weekly Lane-B scrapers + every-2-days Lane-A tournament calendar
          // extraction. (Was imported but never invoked before — the weekly
          // scraper cron had silently never been running.)
          initializeScraperScheduler();
        }
      });

      server.on("error", (err: any) => {
        if (err && err.code === "EADDRINUSE" && attempts > 0) {
          console.warn(`Port ${port} in use, trying ${port + 1}...`);
          attempts -= 1;
          // Close this server before trying the next port.
          server?.close(() => setTimeout(() => startListening(port + 1), 100));
          return;
        }

        console.error("❌ Failed to start server:", err);
        process.exit(1);
      });

      server.listen(port);
    };

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\n🛑 Shutting down server...");
      try {
        if (server) {
          server.close(() => {
            console.log("🛑 HTTP server closed");
            try {
              stopOutboxWorker?.();
              console.log("📨 Outbox worker stopped");
            } catch (err) {
              console.error("Failed stopping outbox worker:", err);
            }
          });
        } else {
          try {
            stopOutboxWorker?.();
            console.log("📨 Outbox worker stopped");
          } catch (err) {
            console.error("Failed stopping outbox worker:", err);
          }
        }

        // Disconnect Redis pub/sub clients cleanly (only if Redis was available)
        if (redisPub && redisSub) {
          await Promise.allSettled([redisPub.quit(), redisSub.quit()]);
          console.log("🔴 Redis pub/sub disconnected");
        }
      } catch (err) {
        console.error("Error during shutdown:", err);
      }
    };

    // Attempt to bind to configured port, with fallback retries
    startListening(Number(PORT));

    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start
startServer();

export default app;
