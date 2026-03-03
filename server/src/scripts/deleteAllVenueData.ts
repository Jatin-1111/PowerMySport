import "dotenv/config";
import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { BookingSlotLock } from "../models/BookingSlotLock";
import { Review } from "../models/Review";
import { Venue } from "../models/Venue";
import VenueInquiry from "../models/VenueInquiry";

const run = async () => {
  const confirmation = process.env.CONFIRM_DELETE_ALL_VENUES;
  if (confirmation !== "yes") {
    console.error(
      "❌ Refusing to run. Set CONFIRM_DELETE_ALL_VENUES=yes to confirm permanent deletion.",
    );
    process.exit(1);
  }

  try {
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/powermysport";

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const venues = await Venue.find({}, { _id: 1 }).lean();
    const venueIds = venues.map((venue) => venue._id);

    console.log(`📦 Found ${venueIds.length} venue(s) to purge.`);

    const [
      bookingResult,
      reviewResult,
      inquiryResult,
      venueResult,
      lockResult,
    ] = await Promise.all([
      Booking.deleteMany({ venueId: { $exists: true, $ne: null } }),
      Review.deleteMany({ targetType: "VENUE" }),
      VenueInquiry.deleteMany({}),
      Venue.deleteMany({}),
      BookingSlotLock.deleteMany({ resourceType: "VENUE_DAY" }),
    ]);

    console.log("\n🧹 Venue data purge complete:");
    console.log(`- Bookings deleted: ${bookingResult.deletedCount || 0}`);
    console.log(`- Reviews deleted: ${reviewResult.deletedCount || 0}`);
    console.log(
      `- Venue inquiries deleted: ${inquiryResult.deletedCount || 0}`,
    );
    console.log(`- Venues deleted: ${venueResult.deletedCount || 0}`);
    console.log(`- Venue slot locks deleted: ${lockResult.deletedCount || 0}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to purge venue data:", error);
    process.exit(1);
  }
};

run();
