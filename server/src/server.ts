import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app";
import { connectDB } from "./config/database";
import { setupCommunitySocket } from "./sockets/communitySocket";
import {
  setupFriendSocket,
  setFriendSocketInstance,
} from "./sockets/friendSocket";
import {
  setupNotificationSocket,
  setupPresenceSocket,
} from "./sockets/notificationSocket";
import { setNotificationSocketInstance } from "./services/NotificationService";
import { setCommunityRealtimeSocketInstance } from "./services/CommunityRealtimeService";
import { startExpirationJob } from "./utils/timer";
import { initializeReminderScheduler } from "./utils/reminderScheduler";
const PORT = process.env.PORT || 5000;

const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/$/, "").toLowerCase();

const configuredOrigins = [
  process.env.FRONTEND_URLS,
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "https://powermysport.com",
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

    // Setup both socket handlers on the same instance
    setupCommunitySocket(io);
    setupFriendSocket(io);
    setupNotificationSocket(io);
    setupPresenceSocket(io);
    setFriendSocketInstance(io);
    setNotificationSocketInstance(io);
    setCommunityRealtimeSocketInstance(io);

    console.log("🔧 Socket.IO namespaces configured:");
    console.log("   - /community (requires community profile)");
    console.log("   - /friends (basic auth)");
    console.log("   - /presence (user presence tracking)");
    console.log("   - /notifications (real-time monitoring)");

    const server = httpServer.listen(PORT, () => {
      console.log(`\n✅ Server is running on http://localhost:${PORT}`);
      console.log(`💬 Community socket ready`);
      console.log(`👥 Friend socket ready`);
      console.log(`📝 API Documentation:`);
      // ... (keep existing logs if desired, or shorten them) ...
      console.log(`   AUTH:`);
      console.log(`   - POST   /api/auth/register`);
      console.log(`   - POST   /api/auth/login`);
      console.log(`   - POST   /api/auth/logout`);
      console.log(`   - GET    /api/auth/profile`);
      console.log(`   VENUES:`);
      console.log(`   - POST   /api/venues`);
      console.log(`   - GET    /api/venues/discover (NEW: venues + coaches)`);
      console.log(`   - GET    /api/venues/search`);
      console.log(`   - GET    /api/venues/my-venues`);
      console.log(`   - GET    /api/venues/:venueId`);
      console.log(`   - PUT    /api/venues/:venueId`);
      console.log(`   - DELETE /api/venues/:venueId`);
      console.log(`   VENUE ONBOARDING (NEW: 3-Step Process):`);
      console.log(`   - POST   /api/venues/onboarding/step1 (Create venue)`);
      console.log(
        `   - POST   /api/venues/onboarding/step2/upload-urls (Get image upload URLs)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/step2/confirm (Confirm images)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/step3/upload-urls (Get document upload URLs)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/step3/finalize (Finalize onboarding)`,
      );
      console.log(
        `   - DELETE /api/venues/onboarding/:venueId (Cancel onboarding)`,
      );
      console.log(`   ADMIN VENUE MANAGEMENT (NEW):`);
      console.log(
        `   - GET    /api/venues/onboarding/admin/pending (List pending venues)`,
      );
      console.log(
        `   - GET    /api/venues/onboarding/admin/:venueId (Get venue details)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/admin/:venueId/approve (Approve venue)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/admin/:venueId/reject (Reject venue)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/admin/:venueId/mark-review (Mark for review)`,
      );
      console.log(`   COACHES:`);
      console.log(`   - POST   /api/coaches`);
      console.log(`   - GET    /api/coaches/my-profile`);
      console.log(`   - GET    /api/coaches/:coachId`);
      console.log(`   - PUT    /api/coaches/:coachId`);
      console.log(`   - DELETE /api/coaches/:coachId`);
      console.log(`   - GET    /api/coaches/availability/:coachId`);
      console.log(`   BOOKINGS:`);
      console.log(`   - POST   /api/bookings/initiate (NEW: split payments)`);
      console.log(
        `   - GET    /api/bookings/verify/:token (NEW: QR verification)`,
      );
      console.log(`   - GET    /api/bookings/my-bookings`);
      console.log(`   - GET    /api/bookings/availability/:venueId`);
      console.log(`   - DELETE /api/bookings/:bookingId`);
      console.log(`   COMMUNITY:`);
      console.log(`   - GET    /api/community/profile`);
      console.log(`   - PATCH  /api/community/profile`);
      console.log(`   - GET    /api/community/conversations`);
      console.log(`   - POST   /api/community/messages\n`);
      console.log(`   GEO:`);
      console.log(`   - GET    /api/geo/autocomplete?q=...`);
      console.log(`   - GET    /api/geo/geocode?address=...`);
      console.log(`   - GET    /api/geo/reverse?lat=...&lon=...`);

      // Start booking expiration job
      startExpirationJob();
      console.log(`⏰ Booking expiration job started`);

      // Start reminder scheduler
      initializeReminderScheduler();
      console.log(`🔔 Booking reminder scheduler started\n`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\n🛑 Shutting down server...");
      server.close(async () => {
        console.log("🛑 HTTP server closed");
        // process.exit(0); // database.ts handles mongo connection close on SIGINT, but we can double check or trigger it here if needed.
        // Since database.ts has process.on('SIGINT'), it might catch it first or parallel.
        // Ideally we coordinate. For now, we'll let existing listeners handle their parts.
      });
    };

    process.on("SIGTERM", shutdown);
    // SIGINT is already handled in database.ts which calls process.exit,
    // so we might not need to duplicate it here unless we want to close server first within that handler.
    // But since server.close takes a callback, asynchronous coordination is tricky with multiple listeners.
    // For this step, I'll just keep the server variable assignment so we *could* close it.
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
