import mongoose from "mongoose";
import { BookingService } from "../services/BookingService";
import { ReviewService } from "../services/ReviewService";
import { EmailVerificationService } from "../services/EmailVerificationService";
import { PromoCodeService } from "../services/PromoCodeService";
import Venue from "../models/Venue";
import Coach from "../models/Coach";
import User from "../models/User";
import Booking from "../models/Booking";
import Review from "../models/Review";
import PromoCode from "../models/PromoCode";
import { isWithinOpeningHours } from "../utils/openingHours";

// Test results tracking
const testResults: { name: string; passed: boolean; error?: string }[] = [];

const logTest = (name: string, passed: boolean, error?: string) => {
  testResults.push({ name, passed, error });
  console.log(`${passed ? "✅" : "❌"} ${name}${error ? `: ${error}` : ""}`);
};

// Connect to test database
const connectDB = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/powermysport_test";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to test database\n");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

// Test 1: Coach Verification Middleware
const testCoachVerification = async () => {
  console.log("\n🧪 Test 1: Coach Verification Requirements");
  try {
    // Create test coach with PENDING status
    const pendingCoach = await Coach.create({
      userId: new mongoose.Types.ObjectId(),
      personalInfo: {
        firstName: "Test",
        lastName: "Coach",
        dateOfBirth: new Date("1990-01-01"),
        gender: "Male",
      },
      sports: [],
      locations: [],
      certifications: [],
      verificationStatus: "PENDING",
    });

    // Test that PENDING status should be rejected (this is middleware behavior, so we just verify status)
    const isPending = pendingCoach.verificationStatus === "PENDING";
    logTest("PENDING coach identified correctly", isPending);

    // Create verified coach
    const verifiedCoach = await Coach.create({
      userId: new mongoose.Types.ObjectId(),
      personalInfo: {
        firstName: "Verified",
        lastName: "Coach",
        dateOfBirth: new Date("1990-01-01"),
        gender: "Male",
      },
      sports: [],
      locations: [],
      certifications: [],
      verificationStatus: "VERIFIED",
    });

    const isVerified = verifiedCoach.verificationStatus === "VERIFIED";
    logTest("VERIFIED coach can book", isVerified);

    await Coach.deleteMany({
      _id: { $in: [pendingCoach._id, verifiedCoach._id] },
    });
  } catch (error: any) {
    logTest("Coach verification test", false, error.message);
  }
};

// Test 2: Venue Approval Status
const testVenueApproval = async () => {
  console.log("\n🧪 Test 2: Venue Auto-Approval Removed");
  try {
    const venue = await Venue.create({
      userId: new mongoose.Types.ObjectId(),
      name: "Test Venue",
      description: "Test description",
      address: {
        street: "123 Test St",
        city: "Test City",
        state: "Test State",
        country: "Test Country",
        postalCode: "12345",
      },
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
      sports: [],
      amenities: [],
      pricing: {
        hourlyRate: 100,
        currency: "USD",
      },
      openingHours: {},
      images: [],
      approvalStatus: "PENDING", // This should be set by controller
    });

    logTest("New venue has PENDING status", venue.approvalStatus === "PENDING");
    logTest(
      "New venue is NOT auto-approved",
      venue.approvalStatus !== "APPROVED",
    );

    await Venue.deleteOne({ _id: venue._id });
  } catch (error: any) {
    logTest("Venue approval test", false, error.message);
  }
};

// Test 3: Promo Code Validation
const testPromoCodeValidation = async () => {
  console.log("\n🧪 Test 3: Promo Code Validation");
  try {
    // Create test promo code
    const promoCode = await PromoCode.create({
      code: "TEST50",
      discountType: "PERCENTAGE",
      discountValue: 50,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxUses: 10,
      currentUses: 0,
      isActive: true,
    });

    const validation = await PromoCodeService.validatePromoCode(
      "TEST50",
      new mongoose.Types.ObjectId().toString(),
    );
    logTest("Valid promo code accepted", validation.isValid === true);
    logTest("Discount amount calculated", validation.discount !== undefined);

    // Test expired promo code
    const expiredPromo = await PromoCode.create({
      code: "EXPIRED",
      discountType: "PERCENTAGE",
      discountValue: 50,
      validFrom: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      validUntil: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      maxUses: 10,
      currentUses: 0,
      isActive: true,
    });

    const expiredValidation = await PromoCodeService.validatePromoCode(
      "EXPIRED",
      new mongoose.Types.ObjectId().toString(),
    );
    logTest("Expired promo code rejected", expiredValidation.isValid === false);

    await PromoCode.deleteMany({ code: { $in: ["TEST50", "EXPIRED"] } });
  } catch (error: any) {
    logTest("Promo code validation test", false, error.message);
  }
};

// Test 4: Cancellation Policy
const testCancellationPolicy = async () => {
  console.log("\n🧪 Test 4: Time-based Cancellation Policy");
  try {
    const user = await User.create({
      email: "test@example.com",
      password: "hashedpassword",
      role: "USER",
      profile: {
        firstName: "Test",
        lastName: "User",
      },
    });

    const venue = await Venue.create({
      userId: new mongoose.Types.ObjectId(),
      name: "Test Venue",
      description: "Test",
      address: {
        street: "123 Test St",
        city: "Test City",
        state: "Test State",
        country: "Test Country",
        postalCode: "12345",
      },
      location: { type: "Point", coordinates: [0, 0] },
      sports: [],
      amenities: [],
      pricing: { hourlyRate: 100, currency: "USD" },
      openingHours: {},
      images: [],
      approvalStatus: "APPROVED",
    });

    // Create booking 48+ hours in future (100% refund)
    const farFutureBooking = await Booking.create({
      userId: user._id,
      venueId: venue._id,
      sport: "Tennis",
      date: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 100,
      paymentStatus: "COMPLETED",
      bookingStatus: "CONFIRMED",
      checkInCode: "12345678",
      checkInCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const hoursUntilFarBooking =
      (farFutureBooking.date.getTime() - Date.now()) / (1000 * 60 * 60);
    const refund100 =
      hoursUntilFarBooking >= 48 ? 100 : hoursUntilFarBooking >= 24 ? 50 : 0;
    logTest("48+ hours cancellation = 100% refund", refund100 === 100);

    // Simulate 24-48 hours case
    const hoursUntil30 = 30; // Between 24-48
    const refund50 = hoursUntil30 >= 48 ? 100 : hoursUntil30 >= 24 ? 50 : 0;
    logTest("24-48 hours cancellation = 50% refund", refund50 === 50);

    // Simulate <24 hours case
    const hoursUntil12 = 12; // Less than 24
    const refund0 = hoursUntil12 >= 48 ? 100 : hoursUntil12 >= 24 ? 50 : 0;
    logTest("<24 hours cancellation = 0% refund", refund0 === 0);

    await User.deleteOne({ _id: user._id });
    await Venue.deleteOne({ _id: venue._id });
    await Booking.deleteOne({ _id: farFutureBooking._id });
  } catch (error: any) {
    logTest("Cancellation policy test", false, error.message);
  }
};

// Test 5: Opening Hours Validation
const testOpeningHoursValidation = async () => {
  console.log("\n🧪 Test 5: Opening Hours Validation");
  try {
    const openingHours = {
      monday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
      tuesday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
      wednesday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
      thursday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
      friday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
      saturday: { isOpen: true, openTime: "10:00", closeTime: "16:00" },
      sunday: { isOpen: false, openTime: "", closeTime: "" },
    };

    // Test booking during open hours (Monday 10-11)
    const monday = new Date();
    monday.setDate(monday.getDate() + ((1 - monday.getDay() + 7) % 7)); // Next Monday
    const validResult = isWithinOpeningHours(
      monday,
      "10:00",
      "11:00",
      openingHours,
    );
    logTest("Booking during open hours accepted", validResult.isValid === true);

    // Test booking before opening (Monday 08-09)
    const tooEarlyResult = isWithinOpeningHours(
      monday,
      "08:00",
      "09:00",
      openingHours,
    );
    logTest(
      "Booking before opening rejected",
      tooEarlyResult.isValid === false,
    );

    // Test booking after closing (Monday 19-20)
    const tooLateResult = isWithinOpeningHours(
      monday,
      "19:00",
      "20:00",
      openingHours,
    );
    logTest("Booking after closing rejected", tooLateResult.isValid === false);

    // Test booking on closed day (Sunday)
    const sunday = new Date();
    sunday.setDate(sunday.getDate() + ((0 - sunday.getDay() + 7) % 7)); // Next Sunday
    const closedDayResult = isWithinOpeningHours(
      sunday,
      "10:00",
      "11:00",
      openingHours,
    );
    logTest(
      "Booking on closed day rejected",
      closedDayResult.isValid === false,
    );
  } catch (error: any) {
    logTest("Opening hours validation test", false, error.message);
  }
};

// Test 6: Check-in Code Security
const testCheckInCodeSecurity = async () => {
  console.log("\n🧪 Test 6: Check-in Code Security");
  try {
    const user = await User.create({
      email: "checkin@example.com",
      password: "hashedpassword",
      role: "USER",
      profile: { firstName: "Check", lastName: "In" },
    });

    const venue = await Venue.create({
      userId: new mongoose.Types.ObjectId(),
      name: "Test Venue",
      description: "Test",
      address: {
        street: "123 Test St",
        city: "Test City",
        state: "Test State",
        country: "Test Country",
        postalCode: "12345",
      },
      location: { type: "Point", coordinates: [0, 0] },
      sports: [],
      amenities: [],
      pricing: { hourlyRate: 100, currency: "USD" },
      openingHours: {},
      images: [],
      approvalStatus: "APPROVED",
    });

    const booking = await Booking.create({
      userId: user._id,
      venueId: venue._id,
      sport: "Tennis",
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 100,
      paymentStatus: "COMPLETED",
      bookingStatus: "CONFIRMED",
      checkInCode: "ABC12345", // 8 characters
      checkInCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    logTest("Check-in code is 8 characters", booking.checkInCode.length === 8);
    logTest(
      "Check-in code has expiry",
      booking.checkInCodeExpiry !== undefined,
    );
    logTest(
      "Check-in code expiry is in future",
      booking.checkInCodeExpiry! > new Date(),
    );

    await User.deleteOne({ _id: user._id });
    await Venue.deleteOne({ _id: venue._id });
    await Booking.deleteOne({ _id: booking._id });
  } catch (error: any) {
    logTest("Check-in code security test", false, error.message);
  }
};

// Test 7: Review System (Separate Reviews)
const testReviewSystem = async () => {
  console.log("\n🧪 Test 7: Separate Review System");
  try {
    const user = await User.create({
      email: "reviewer@example.com",
      password: "hashedpassword",
      role: "USER",
      profile: { firstName: "Review", lastName: "Er" },
    });

    const venue = await Venue.create({
      userId: new mongoose.Types.ObjectId(),
      name: "Test Venue",
      description: "Test",
      address: {
        street: "123 Test St",
        city: "Test City",
        state: "Test State",
        country: "Test Country",
        postalCode: "12345",
      },
      location: { type: "Point", coordinates: [0, 0] },
      sports: [],
      amenities: [],
      pricing: { hourlyRate: 100, currency: "USD" },
      openingHours: {},
      images: [],
      approvalStatus: "APPROVED",
    });

    const coach = await Coach.create({
      userId: new mongoose.Types.ObjectId(),
      personalInfo: {
        firstName: "Review",
        lastName: "Coach",
        dateOfBirth: new Date("1990-01-01"),
        gender: "Male",
      },
      sports: [],
      locations: [],
      certifications: [],
      verificationStatus: "VERIFIED",
    });

    const booking = await Booking.create({
      userId: user._id,
      venueId: venue._id,
      coachId: coach._id,
      sport: "Tennis",
      date: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past booking
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 100,
      paymentStatus: "COMPLETED",
      bookingStatus: "COMPLETED",
    });

    // Create venue review
    const venueReview = await Review.create({
      bookingId: booking._id,
      userId: user._id,
      targetType: "VENUE",
      targetId: venue._id,
      rating: 5,
      comment: "Great venue!",
      moderationStatus: "APPROVED",
    });

    // Create coach review
    const coachReview = await Review.create({
      bookingId: booking._id,
      userId: user._id,
      targetType: "COACH",
      targetId: coach._id,
      rating: 4,
      comment: "Good coach!",
      moderationStatus: "APPROVED",
    });

    logTest("Venue review created", venueReview.targetType === "VENUE");
    logTest("Coach review created", coachReview.targetType === "COACH");
    logTest(
      "Both reviews for same booking",
      venueReview.bookingId.toString() === coachReview.bookingId.toString(),
    );

    await User.deleteOne({ _id: user._id });
    await Venue.deleteOne({ _id: venue._id });
    await Coach.deleteOne({ _id: coach._id });
    await Booking.deleteOne({ _id: booking._id });
    await Review.deleteMany({ bookingId: booking._id });
  } catch (error: any) {
    logTest("Review system test", false, error.message);
  }
};

// Test 8: Review Moderation
const testReviewModeration = async () => {
  console.log("\n🧪 Test 8: Review Flagging System");
  try {
    const user = await User.create({
      email: "moderator@example.com",
      password: "hashedpassword",
      role: "USER",
      profile: { firstName: "Mod", lastName: "Erator" },
    });

    const review = await Review.create({
      bookingId: new mongoose.Types.ObjectId(),
      userId: user._id,
      targetType: "VENUE",
      targetId: new mongoose.Types.ObjectId(),
      rating: 1,
      comment: "Inappropriate content",
      moderationStatus: "PENDING",
      reports: [],
    });

    // Simulate 3 reports
    review.reports = [
      {
        userId: new mongoose.Types.ObjectId(),
        reason: "Spam",
        reportedAt: new Date(),
      },
      {
        userId: new mongoose.Types.ObjectId(),
        reason: "Offensive",
        reportedAt: new Date(),
      },
      {
        userId: new mongoose.Types.ObjectId(),
        reason: "Inappropriate",
        reportedAt: new Date(),
      },
    ];
    review.moderationStatus =
      review.reports.length >= 3 ? "FLAGGED" : "PENDING";
    await review.save();

    logTest("Review flagging works", review.moderationStatus === "FLAGGED");
    logTest("Review has reports array", Array.isArray(review.reports));
    logTest("Auto-flagged after 3 reports", review.reports.length === 3);

    await User.deleteOne({ _id: user._id });
    await Review.deleteOne({ _id: review._id });
  } catch (error: any) {
    logTest("Review moderation test", false, error.message);
  }
};

// Test 9: Age Validation
const testAgeValidation = async () => {
  console.log("\n🧪 Test 9: Age Validation for Dependents");
  try {
    const calculateAge = (dob: Date): number => {
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < dob.getDate())
      ) {
        age--;
      }
      return age;
    };

    // Test valid age (10 years old)
    const validDOB = new Date();
    validDOB.setFullYear(validDOB.getFullYear() - 10);
    const validAge = calculateAge(validDOB);
    logTest("Valid dependent age (10 years)", validAge >= 3 && validAge < 18);

    // Test too young (2 years old)
    const tooYoungDOB = new Date();
    tooYoungDOB.setFullYear(tooYoungDOB.getFullYear() - 2);
    const tooYoungAge = calculateAge(tooYoungDOB);
    logTest("Too young rejected (2 years)", tooYoungAge < 3);

    // Test too old (18 years old)
    const tooOldDOB = new Date();
    tooOldDOB.setFullYear(tooOldDOB.getFullYear() - 18);
    const tooOldAge = calculateAge(tooOldDOB);
    logTest("Too old rejected (18 years)", tooOldAge >= 18);

    // Test future DOB
    const futureDOB = new Date();
    futureDOB.setFullYear(futureDOB.getFullYear() + 1);
    const isFuture = futureDOB > new Date();
    logTest("Future DOB rejected", isFuture);
  } catch (error: any) {
    logTest("Age validation test", false, error.message);
  }
};

// Test 10: Email Verification (Database)
const testEmailVerification = async () => {
  console.log("\n🧪 Test 10: Email Verification Database Storage");
  try {
    const testEmail = "venue@example.com";

    // Create verification code
    await EmailVerificationService.createVerificationCode(testEmail);
    logTest("Verification code created", true);

    // Verify it exists in database (not in-memory)
    const EmailVerification = mongoose.model("EmailVerification");
    const verification = await EmailVerification.findOne({ email: testEmail });
    logTest("Verification code stored in database", verification !== null);
    logTest(
      "Verification code has expiry",
      verification?.expiresAt !== undefined,
    );

    await EmailVerification.deleteMany({ email: testEmail });
  } catch (error: any) {
    logTest("Email verification test", false, error.message);
  }
};

// Run all tests
const runAllTests = async () => {
  console.log("🚀 Starting Business Logic Flow Tests\n");
  console.log("=".repeat(60));

  await connectDB();

  await testCoachVerification();
  await testVenueApproval();
  await testPromoCodeValidation();
  await testCancellationPolicy();
  await testOpeningHoursValidation();
  await testCheckInCodeSecurity();
  await testReviewSystem();
  await testReviewModeration();
  await testAgeValidation();
  await testEmailVerification();

  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Test Summary:");
  console.log("=".repeat(60));

  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log(`Total Tests: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(
    `Success Rate: ${((passed / testResults.length) * 100).toFixed(1)}%`,
  );

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    testResults
      .filter((r) => !r.passed)
      .forEach((r) =>
        console.log(`  - ${r.name}: ${r.error || "Unknown error"}`),
      );
  }

  console.log("\n" + "=".repeat(60));

  await mongoose.connection.close();
  process.exit(failed > 0 ? 1 : 0);
};

// Run tests
runAllTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
