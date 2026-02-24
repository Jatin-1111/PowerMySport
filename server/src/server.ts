import "dotenv/config";
import app from "./app";
import { connectDB } from "./config/database";
import { startExpirationJob } from "./utils/timer";
const PORT = process.env.PORT || 5000;

// Start server function
const startServer = async () => {
  try {
    // Connect to Database
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`\n✅ Server is running on http://localhost:${PORT}`);
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
      console.log(`   - POST   /api/bookings/webhook (Stripe webhook)`);
      console.log(
        `   - GET    /api/bookings/verify/:token (NEW: QR verification)`,
      );
      console.log(`   - GET    /api/bookings/my-bookings`);
      console.log(`   - GET    /api/bookings/availability/:venueId`);
      console.log(`   - DELETE /api/bookings/:bookingId\n`);
      console.log(`   GEO:`);
      console.log(`   - GET    /api/geo/autocomplete?q=...`);
      console.log(`   - GET    /api/geo/geocode?address=...`);
      console.log(`   - GET    /api/geo/reverse?lat=...&lon=...`);

      // Start booking expiration job
      startExpirationJob();
      console.log(`⏰ Booking expiration job started\n`);
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
