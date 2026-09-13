import "./config/env";
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import app from "./app";
import { createRedisPubSub } from "./config/redis";
import { connectDB } from "./config/database";
import { setupCommunitySocket } from "./community/sockets/communitySocket";
import { setupFriendSocket, setFriendSocketInstance } from "./client/sockets/friendSocket";
import { setupNotificationSocket, setupPresenceSocket } from "./client/sockets/notificationSocket";
import { setupBookingSocket, setBookingSocketInstance } from "./client/sockets/bookingSocket";
import { setupInfraSocket } from "./admin/sockets/infraSocket";
import { setNotificationSocketInstance } from "./client/services/NotificationService";
import { setCommunityRealtimeSocketInstance } from "./community/services/CommunityRealtimeService";
import { startExpirationJob } from "./utils/timer";
import { initializeReminderScheduler } from "./utils/reminderScheduler";
import { initializeExperienceNudgeScheduler } from "./utils/experienceNudgeScheduler";
import { startOutboxWorker } from "./shared/services/OutboxService";
import { initializeScraperScheduler } from "./utils/scraperScheduler";
import { initializeAitaRankingScheduler } from "./utils/aitaRankingScheduler";
import { initializeScheduledJobs } from "./utils/scheduledJobs";
import { startLogDigest, stopLogDigest } from "./utils/logDigest";
import { bootFact, bootReady, bootWarn } from "./utils/boot";
import { log as __rootLog } from "./utils/logger";
const log = __rootLog.child("server");
const PORT = process.env.PORT || 5000;

/**
 * Whether this process should run the background writers (crons, outbox worker).
 *
 * Production runs them; nothing else does unless it says so. `RUN_SCHEDULERS`
 * is read as an explicit opt-in/opt-out and wins over the default either way.
 */
const runSchedulers = (): boolean => {
  const flag = process.env.RUN_SCHEDULERS?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
};

let stopOutboxWorker: (() => void) | null = null;

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/$/, "").toLowerCase();

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

  return allowedOriginPatterns.some((pattern) => pattern.test(normalizedOrigin));
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
      bootFact("redis", "socket.io adapter attached");
    } catch {
      bootWarn(
        "Redis unavailable — single-instance mode (start Redis to enable horizontal scaling)"
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

    bootFact("sockets", "/community /friends /presence /notifications /bookings");

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
        bootFact("http", `http://localhost:${port}`);

        // Guard: only start background jobs once, even if retried ports.
        if (!jobsStarted) {
          jobsStarted = true;

          // Scheduled cleanup jobs (moved from app.ts to here so they only
          // run after the server is confirmed listening).
          // Periodic terminal digest (dev by default, opt-in via LOG_DIGEST_MS).
          startLogDigest();

          // ── Background writers ──
          //
          // Everything below WRITES: real emails to real users, expired
          // bookings, drained outbox messages, scraped tournament rows,
          // ingested ranking snapshots. None of it is tied to a request, so it
          // runs against whatever database the process happens to point at.
          //
          // That is why it is gated. Local development frequently has to point
          // at the production database — the dev database has no real data and
          // the cluster's free tier rules out keeping a full copy in both — and
          // a laptop that boots the schedulers while pointed there emails
          // customers and ingests data on prod's behalf. That is not
          // hypothetical: a dev-server cron auto-ingested into production on
          // 2026-08-29.
          //
          // Default is production-only, so the deployed server needs no new
          // env var and a local boot is safe by default. `RUN_SCHEDULERS`
          // overrides in both directions for the rare case that wants the
          // opposite (a staging box that should run them, or a production
          // shell that should not).
          if (runSchedulers()) {
            initializeScheduledJobs();

            // Start booking expiration job
            startExpirationJob();

            // Start reminder scheduler
            initializeReminderScheduler();

            // Daily sweep: "share your experience?" nudges for recently-
            // completed venue/academy/coach bookings and expert sessions.
            initializeExperienceNudgeScheduler();

            // Start outbox worker to handle message notification delivery and retries
            stopOutboxWorker = startOutboxWorker();
            bootFact("jobs", "outbox");

            // Weekly Lane-B scrapers + every-2-days Lane-A tournament calendar
            // extraction. (Was imported but never invoked before — the weekly
            // scraper cron had silently never been running.)
            initializeScraperScheduler();

            // Hourly tripwire + Thursday sweep for the AITA ranking mirror.
            initializeAitaRankingScheduler();
          } else {
            // Stated on every boot rather than logged quietly: "why did the
            // reminder email never go out" is the question this answers.
            bootFact("jobs", "schedulers OFF (set RUN_SCHEDULERS=true to enable)");
          }

          // Everything above has registered its boot facts; print the block.
          bootReady();
        }
      });

      server.on("error", (err: any) => {
        if (err && err.code === "EADDRINUSE" && attempts > 0) {
          log.warn(`Port ${port} in use, trying ${port + 1}...`);
          attempts -= 1;
          // Close this server before trying the next port.
          server?.close(() => setTimeout(() => startListening(port + 1), 100));
          return;
        }

        log.error("Failed to start server:", err);
        process.exit(1);
      });

      server.listen(port);
    };

    // Graceful shutdown
    const shutdown = async () => {
      log.info("Shutting down server...");
      stopLogDigest();
      try {
        if (server) {
          server.close(() => {
            log.info("HTTP server closed");
            try {
              stopOutboxWorker?.();
              log.info("Outbox worker stopped");
            } catch (err) {
              log.error("Failed stopping outbox worker:", err);
            }
          });
        } else {
          try {
            stopOutboxWorker?.();
            log.info("Outbox worker stopped");
          } catch (err) {
            log.error("Failed stopping outbox worker:", err);
          }
        }

        // Disconnect Redis pub/sub clients cleanly (only if Redis was available)
        if (redisPub && redisSub) {
          await Promise.allSettled([redisPub.quit(), redisSub.quit()]);
          log.info("Redis pub/sub disconnected");
        }
      } catch (err) {
        log.error("Error during shutdown:", err);
      }
    };

    // Attempt to bind to configured port, with fallback retries
    startListening(Number(PORT));

    process.on("SIGTERM", shutdown);
  } catch (error) {
    log.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start
startServer();

export default app;
