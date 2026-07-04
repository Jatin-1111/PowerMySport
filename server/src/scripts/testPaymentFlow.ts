import mongoose from "mongoose";
import { initiateBooking, InitiateBookingPayload } from "../client/services/BookingService";
import { Venue } from "../client/models/Venue";
import { Coach } from "../client/models/Coach";
import { User } from "../client/models/User";
import { Booking } from "../client/models/Booking";
import { releaseCompletedBookingPayments } from "../utils/scheduledJobs";

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/powermysport_test";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to test database\n");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

const runPaymentFlowTest = async () => {
  console.log("🚀 Starting Payment Flow Test");
  console.log("=".repeat(60));

  await connectDB();

  let testFailed = false;
  let venueOwnerId: any;
  let coachUserId: any;
  let playerId: any;

  try {
    // 1. Setup Stakeholders
    const venueOwner = await User.create({
      email: `venue_owner_paytest_${Date.now()}@example.com`,
      password: "hashedpassword",
      phone: `12${Date.now().toString().slice(-8)}`,
      role: "VenueLister",
      name: "Venue Owner",
    } as any);

    const coachUser = await User.create({
      email: `coach_paytest_${Date.now()}@example.com`,
      password: "hashedpassword",
      phone: `34${Date.now().toString().slice(-8)}`,
      role: "Coach",
      name: "Pro Coach",
    } as any);

    const player = await User.create({
      email: `player_paytest_${Date.now()}@example.com`,
      password: "hashedpassword",
      phone: `56${Date.now().toString().slice(-8)}`,
      role: "Player",
      name: "Active Player",
    } as any);
    
    venueOwnerId = venueOwner._id;
    coachUserId = coachUser._id;
    playerId = player._id;

    const venue = await Venue.create({
      ownerName: "Venue Owner",
      ownerEmail: venueOwner.email,
      ownerPhone: venueOwner.phone,
      ownerId: venueOwnerId,
      name: "Payment Flow Test Venue",
      description: "Testing payouts",
      address: "123 Pay St, Pay City",
      location: { type: "Point", coordinates: [0, 0] },
      sports: ["Tennis"],
      pricePerHour: 100,
      amenities: [],
      pricing: { hourlyRate: 100, currency: "USD" },
      openingHours: {},
      images: [],
      approvalStatus: "APPROVED",
      allowExternalCoaches: true,
    } as any);

    const coach = await Coach.create({
      userId: coachUser._id,
      personalInfo: {
        firstName: "Pro",
        lastName: "Coach",
        dateOfBirth: new Date("1990-01-01"),
        gender: "Male",
      },
      sports: ["Tennis"],
      hourlyRate: 50,
      locations: [],
      certifications: [],
      verificationStatus: "VERIFIED",
      serviceMode: "FREELANCE",
      availability: [0,1,2,3,4,5,6].map(day => ({
        dayOfWeek: day,
        startTime: "00:00",
        endTime: "23:59"
      })),
    } as any);

    // 2. Initiate Booking
    console.log("\n🧪 Test: Booking Payment Splits Initialization");
    
    // Choose a future date for the booking
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const payload: InitiateBookingPayload = {
      userId: player._id.toString(),
      venueId: venue._id.toString(),
      coachId: coach._id.toString(),
      sport: "Tennis",
      date: tomorrow,
      startTime: "10:00",
      endTime: "11:00",
    };

    const { booking: initialBooking } = await initiateBooking(payload);
    
    // Verify payments array
    const booking = await Booking.findById(initialBooking._id);
    if (!booking) {
      throw new Error("Booking not found after creation");
    }

    if (!booking.payments || booking.payments.length === 0) {
      console.log("❌ Failed: Booking payments array is empty. Expected splits for Venue and Coach.");
      testFailed = true;
    } else {
      console.log("✅ Passed: Booking payments array is populated.");
      const venuePayment = booking.payments.find(p => p.userType === "VenueLister");
      const coachPayment = booking.payments.find(p => p.userType === "Coach");
      
      if (!venuePayment || venuePayment.status !== "PENDING") {
         console.log("❌ Failed: Venue payment split is missing or not PENDING.");
         testFailed = true;
      }
      if (!coachPayment || coachPayment.status !== "PENDING") {
         console.log("❌ Failed: Coach payment split is missing or not PENDING.");
         testFailed = true;
      }
    }

    // 3. Simulate completion and auto-release
    console.log("\n🧪 Test: Release Completed Booking Payments (Auto-Payout)");
    
    if (testFailed) {
      console.log("⚠️ Skipping auto-release test due to earlier failure.");
    } else {
      // Simulate that the session is completed and was updated > 24 hours ago
      const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      
      await Booking.updateOne(
        { _id: booking._id },
        { 
          $set: { 
            status: "COMPLETED", 
            updatedAt: pastDate 
          }
        },
        { timestamps: false }
      );

      // Run the scheduled job
      await releaseCompletedBookingPayments();

      const updatedBooking = await Booking.findById(booking._id);
      const allPaid = updatedBooking?.payments.every(p => p.status === "PAID");
      
      if (allPaid) {
        console.log("✅ Passed: All payments were marked as PAID by the auto-release job.");
      } else {
        console.log("❌ Failed: Payments were not marked as PAID.");
        testFailed = true;
      }
    }

  } catch (error: any) {
    console.log(`❌ Unexpected error during testing: ${error.message}`);
    testFailed = true;
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await User.deleteMany({ _id: { $in: [
      venueOwnerId, 
      coachUserId, 
      playerId
    ]}});
    await Venue.deleteMany({ name: "Payment Flow Test Venue" });
    await Coach.deleteMany({ hourlyRate: 50, sports: "Tennis" }); // Rough cleanup for coach
    // Booking will be cleaned up implicitly if user references are deleted, but let's be explicit
    // We can't cleanly delete by name, but we can delete all bookings for our test venue
    const testVenue = await Venue.findOne({ name: "Payment Flow Test Venue" });
    if (testVenue) {
      await Booking.deleteMany({ venueId: testVenue._id });
    }
    
    await mongoose.connection.close();
    
    console.log("\n" + "=".repeat(60));
    if (testFailed) {
      console.log("❌ Test Suite Failed.");
      process.exit(1);
    } else {
      console.log("✅ Test Suite Passed Successfully.");
      process.exit(0);
    }
  }
};

runPaymentFlowTest();
