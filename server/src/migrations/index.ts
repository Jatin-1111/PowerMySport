/**
 * Master Migration Runner
 *
 * Run all migrations in sequence
 * Usage: npm run migrate
 */

import { migrateUserRoles } from "./01_migrate_user_roles";
import { migrateVenueLocations } from "./02_migrate_venue_locations";
import { migrateBookingPayments } from "./03_migrate_booking_payments";
import { linkVenuesToOwners } from "./04_link_venues_to_owners";
import { addS3KeysToDocuments } from "./05_add_s3_keys_to_documents";
import { migrateCoachVenueToProfile } from "./06_separate_coach_venue_roles";
import { up as addGroupBookingSupport } from "./07_add_group_booking_support";
import { up as addNotificationsSystem } from "./08_add_notifications_system";

const runAllMigrations = async () => {
  console.log("=".repeat(60));
  console.log("STARTING ALL MIGRATIONS");
  console.log("=".repeat(60));
  console.log();

  try {
    // Migration 1: User Roles
    console.log("📋 Running Migration 1: User Roles");
    console.log("-".repeat(60));
    await migrateUserRoles();
    console.log();

    // Migration 2: Venue Locations
    console.log("📋 Running Migration 2: Venue Locations");
    console.log("-".repeat(60));
    await migrateVenueLocations();
    console.log();

    // Migration 3: Booking Payments
    console.log("📋 Running Migration 3: Booking Payments");
    console.log("-".repeat(60));
    await migrateBookingPayments();
    console.log();

    // Migration 4: Link Venues to Owners
    console.log("📋 Running Migration 4: Link Venues to Owners");
    console.log("-".repeat(60));
    await linkVenuesToOwners();
    console.log();

    // Migration 5: Add S3 Keys
    console.log("📋 Running Migration 5: Add S3 Keys to Images & Documents");
    console.log("-".repeat(60));
    await addS3KeysToDocuments();
    console.log();

    // Migration 6: Separate Coach and Venue-Lister Roles
    console.log(
      "📋 Running Migration 6: Separate Coach and Venue-Lister Roles",
    );
    console.log("-".repeat(60));
    await migrateCoachVenueToProfile();
    console.log();

    // Migration 7: Add Group Booking Support
    console.log("📋 Running Migration 7: Add Group Booking Support");
    console.log("-".repeat(60));
    await addGroupBookingSupport();
    console.log();

    // Migration 8: Add Notifications System
    console.log("📋 Running Migration 8: Add Notifications System");
    console.log("-".repeat(60));
    await addNotificationsSystem();
    console.log();

    console.log("=".repeat(60));
    console.log("✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ MIGRATION FAILED");
    console.error(error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runAllMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runAllMigrations };
