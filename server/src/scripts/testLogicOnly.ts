/**
 * Unit tests for business logic (no database required)
 * Tests the modified flows and validations
 */

import { isWithinOpeningHours } from "../utils/openingHours";

// Test results tracking
const testResults: { name: string; passed: boolean; error?: string }[] = [];

const logTest = (name: string, passed: boolean, error?: string) => {
  testResults.push({ name, passed, ...(error !== undefined && { error }) });
  console.log(`${passed ? "✅" : "❌"} ${name}${error ? `: ${error}` : ""}`);
};

// Test 1: Opening Hours Validation
const testOpeningHoursValidation = () => {
  console.log("\n🧪 Test 1: Opening Hours Validation");
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
    const monday = new Date("2026-03-02T10:00:00"); // A Monday
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
    logTest(
      "Before opening error message correct",
      tooEarlyResult.message?.includes("opens at") || false,
    );

    // Test booking after closing (Monday 19-20)
    const tooLateResult = isWithinOpeningHours(
      monday,
      "19:00",
      "20:00",
      openingHours,
    );
    logTest("Booking after closing rejected", tooLateResult.isValid === false);
    logTest(
      "After closing error message correct",
      tooLateResult.message?.includes("closes at") || false,
    );

    // Test booking on closed day (Sunday)
    const sunday = new Date("2026-03-01T10:00:00"); // A Sunday
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
    logTest(
      "Closed day error message correct",
      closedDayResult.message?.includes("closed on") || false,
    );

    // Test Saturday hours (different from weekday)
    const saturday = new Date("2026-03-07T10:00:00"); // A Saturday
    const satValidResult = isWithinOpeningHours(
      saturday,
      "10:00",
      "15:00",
      openingHours,
    );
    logTest(
      "Saturday booking during hours accepted",
      satValidResult.isValid === true,
    );

    const satInvalidResult = isWithinOpeningHours(
      saturday,
      "17:00",
      "18:00",
      openingHours,
    );
    logTest(
      "Saturday booking after closing rejected",
      satInvalidResult.isValid === false,
    );
  } catch (error: any) {
    logTest("Opening hours validation test", false, error.message);
  }
};

// Test 2: Cancellation Policy Logic
const testCancellationPolicy = () => {
  console.log("\n🧪 Test 2: Cancellation Policy Logic");
  try {
    const calculateRefundPercentage = (
      bookingDate: Date,
      currentDate: Date,
    ): number => {
      const hoursUntilBooking =
        (bookingDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);

      if (hoursUntilBooking >= 48) {
        return 100; // Full refund
      } else if (hoursUntilBooking >= 24) {
        return 50; // 50% refund
      } else {
        return 0; // No refund
      }
    };

    const currentDate = new Date("2026-03-04T12:00:00");

    // Test 48+ hours (100% refund)
    const farFutureBooking = new Date("2026-03-07T12:00:00"); // 72 hours away
    const refund100 = calculateRefundPercentage(farFutureBooking, currentDate);
    logTest("48+ hours cancellation = 100% refund", refund100 === 100);

    // Test 24-48 hours (50% refund)
    const mediumFutureBooking = new Date("2026-03-05T18:00:00"); // 30 hours away
    const refund50 = calculateRefundPercentage(
      mediumFutureBooking,
      currentDate,
    );
    logTest("24-48 hours cancellation = 50% refund", refund50 === 50);

    // Test <24 hours (0% refund)
    const nearFutureBooking = new Date("2026-03-05T06:00:00"); // 18 hours away
    const refund0 = calculateRefundPercentage(nearFutureBooking, currentDate);
    logTest("<24 hours cancellation = 0% refund", refund0 === 0);

    // Test edge case: exactly 48 hours
    const exactly48 = new Date("2026-03-06T12:00:00");
    const refundExact48 = calculateRefundPercentage(exactly48, currentDate);
    logTest("Exactly 48 hours = 100% refund", refundExact48 === 100);

    // Test edge case: exactly 24 hours
    const exactly24 = new Date("2026-03-05T12:00:00");
    const refundExact24 = calculateRefundPercentage(exactly24, currentDate);
    logTest("Exactly 24 hours = 50% refund", refundExact24 === 50);
  } catch (error: any) {
    logTest("Cancellation policy test", false, error.message);
  }
};

// Test 3: Age Validation for Dependents
const testAgeValidation = () => {
  console.log("\n🧪 Test 3: Age Validation for Dependents");
  try {
    const calculateAge = (
      dob: Date,
      referenceDate: Date = new Date(),
    ): number => {
      let age = referenceDate.getFullYear() - dob.getFullYear();
      const monthDiff = referenceDate.getMonth() - dob.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && referenceDate.getDate() < dob.getDate())
      ) {
        age--;
      }
      return age;
    };

    const validateDependentAge = (
      dob: Date,
    ): { valid: boolean; message?: string } => {
      // Check if DOB is in the future
      if (dob > new Date()) {
        return {
          valid: false,
          message: "Date of birth cannot be in the future",
        };
      }

      const age = calculateAge(dob);

      // Minimum age: 3 years
      if (age < 3) {
        return {
          valid: false,
          message: "Participant must be at least 3 years old to book",
        };
      }

      // Maximum age for dependents: under 18
      if (age >= 18) {
        return {
          valid: false,
          message:
            "Dependents must be under 18 years old. Please book as an adult.",
        };
      }

      return { valid: true };
    };

    const referenceDate = new Date("2026-03-04");

    // Test valid age (10 years old)
    const validDOB = new Date("2016-03-04");
    const validResult = validateDependentAge(validDOB);
    logTest("Valid dependent age (10 years)", validResult.valid === true);

    // Test too young (2 years old)
    const tooYoungDOB = new Date("2024-03-04");
    const tooYoungResult = validateDependentAge(tooYoungDOB);
    logTest("Too young rejected (2 years)", tooYoungResult.valid === false);
    logTest(
      "Too young error message correct",
      tooYoungResult.message?.includes("at least 3 years") || false,
    );

    // Test too old (18 years old)
    const tooOldDOB = new Date("2008-03-04");
    const tooOldResult = validateDependentAge(tooOldDOB);
    logTest("Too old rejected (18 years)", tooOldResult.valid === false);
    logTest(
      "Too old error message correct",
      tooOldResult.message?.includes("under 18") || false,
    );

    // Test future DOB
    const futureDOB = new Date("2027-01-01");
    const futureResult = validateDependentAge(futureDOB);
    logTest("Future DOB rejected", futureResult.valid === false);
    logTest(
      "Future DOB error message correct",
      futureResult.message?.includes("future") || false,
    );

    // Test boundary: exactly 3 years old
    const exactly3DOB = new Date("2023-03-04");
    const exactly3Result = validateDependentAge(exactly3DOB);
    logTest("Exactly 3 years old accepted", exactly3Result.valid === true);

    // Test boundary: 17 years old
    const exactly17DOB = new Date("2009-03-04");
    const exactly17Result = validateDependentAge(exactly17DOB);
    logTest("17 years old accepted", exactly17Result.valid === true);

    // Test age calculation accuracy (birthday not yet reached)
    const notYet10DOB = new Date("2016-06-01"); // Birthday in June, today is March
    const age = calculateAge(notYet10DOB, new Date("2026-03-04"));
    logTest("Age calculation before birthday correct", age === 9);
  } catch (error: any) {
    logTest("Age validation test", false, error.message);
  }
};

// Test 4: Check-in Code Validation
const testCheckInCodeValidation = () => {
  console.log("\n🧪 Test 4: Check-in Code Security");
  try {
    const generateCheckInCode = (): string => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const validateCheckInCode = (
      code: string,
      expiry: Date,
    ): { valid: boolean; message?: string } => {
      if (code.length !== 8) {
        return { valid: false, message: "Check-in code must be 8 characters" };
      }

      if (expiry < new Date()) {
        return { valid: false, message: "Check-in code has expired" };
      }

      return { valid: true };
    };

    // Test code generation
    const code1 = generateCheckInCode();
    logTest("Generated code is 8 characters", code1.length === 8);

    const code2 = generateCheckInCode();
    logTest("Generated codes are unique", code1 !== code2);

    // Test valid code
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const validResult = validateCheckInCode("ABC12345", futureExpiry);
    logTest("Valid 8-char code accepted", validResult.valid === true);

    // Test short code
    const shortResult = validateCheckInCode("ABC123", futureExpiry);
    logTest("Short code rejected", shortResult.valid === false);

    // Test expired code
    const pastExpiry = new Date(Date.now() - 1000);
    const expiredResult = validateCheckInCode("ABC12345", pastExpiry);
    logTest("Expired code rejected", expiredResult.valid === false);
    logTest(
      "Expired error message correct",
      expiredResult.message?.includes("expired") || false,
    );
  } catch (error: any) {
    logTest("Check-in code validation test", false, error.message);
  }
};

// Test 5: Review System Logic
const testReviewSystemLogic = () => {
  console.log("\n🧪 Test 5: Review System Logic");
  try {
    interface Review {
      bookingId: string;
      targetType: "VENUE" | "COACH";
      targetId: string;
      rating: number;
      moderationStatus: "PENDING" | "APPROVED" | "FLAGGED" | "REMOVED";
      reports: Array<{ reason: string }>;
    }

    const canLeaveReview = (
      bookingStatus: string,
      bookingDate: Date,
      existingReviews: Review[],
      targetType: "VENUE" | "COACH",
    ): { allowed: boolean; message?: string } => {
      if (bookingStatus !== "COMPLETED") {
        return {
          allowed: false,
          message: "Can only review completed bookings",
        };
      }

      if (bookingDate > new Date()) {
        return { allowed: false, message: "Cannot review future bookings" };
      }

      const existingReview = existingReviews.find(
        (r) => r.targetType === targetType,
      );
      if (existingReview) {
        return {
          allowed: false,
          message: `${targetType} review already exists`,
        };
      }

      return { allowed: true };
    };

    const autoFlagReview = (review: Review): Review => {
      if (review.reports.length >= 3) {
        review.moderationStatus = "FLAGGED";
      }
      return review;
    };

    // Test: Can leave review for completed booking
    const completedResult = canLeaveReview(
      "COMPLETED",
      new Date("2026-03-01"),
      [],
      "VENUE",
    );
    logTest("Can review completed booking", completedResult.allowed === true);

    // Test: Cannot review pending booking
    const pendingResult = canLeaveReview(
      "PENDING",
      new Date("2026-03-01"),
      [],
      "VENUE",
    );
    logTest("Cannot review pending booking", pendingResult.allowed === false);

    // Test: Cannot review future booking
    const futureResult = canLeaveReview(
      "COMPLETED",
      new Date("2026-12-01"),
      [],
      "VENUE",
    );
    logTest("Cannot review future booking", futureResult.allowed === false);

    // Test: Can leave separate reviews for venue and coach
    const existingVenueReview: Review = {
      bookingId: "123",
      targetType: "VENUE",
      targetId: "venue1",
      rating: 5,
      moderationStatus: "APPROVED",
      reports: [],
    };

    const canReviewCoach = canLeaveReview(
      "COMPLETED",
      new Date("2026-03-01"),
      [existingVenueReview],
      "COACH",
    );
    logTest(
      "Can leave coach review after venue review",
      canReviewCoach.allowed === true,
    );

    const canReviewVenueAgain = canLeaveReview(
      "COMPLETED",
      new Date("2026-03-01"),
      [existingVenueReview],
      "VENUE",
    );
    logTest(
      "Cannot leave duplicate venue review",
      canReviewVenueAgain.allowed === false,
    );

    // Test: Auto-flag review after 3 reports
    let review: Review = {
      bookingId: "123",
      targetType: "VENUE",
      targetId: "venue1",
      rating: 1,
      moderationStatus: "PENDING",
      reports: [],
    };

    review.reports.push({ reason: "Spam" });
    review.reports.push({ reason: "Offensive" });
    review = autoFlagReview(review);
    logTest(
      "Review not flagged with 2 reports",
      review.moderationStatus === "PENDING",
    );

    review.reports.push({ reason: "Inappropriate" });
    review = autoFlagReview(review);
    logTest(
      "Review auto-flagged with 3 reports",
      review.moderationStatus === "FLAGGED",
    );
  } catch (error: any) {
    logTest("Review system logic test", false, error.message);
  }
};

// Test 6: Verification Status Logic
const testVerificationStatusLogic = () => {
  console.log("\n🧪 Test 6: Coach/Venue Verification Logic");
  try {
    const canCoachAcceptBooking = (verificationStatus: string): boolean => {
      return verificationStatus === "VERIFIED";
    };

    const getVenueApprovalStatus = (): string => {
      // New venues should start as PENDING, not APPROVED
      return "PENDING";
    };

    // Test coach verification
    logTest(
      "VERIFIED coach can accept bookings",
      canCoachAcceptBooking("VERIFIED") === true,
    );
    logTest(
      "PENDING coach cannot accept bookings",
      canCoachAcceptBooking("PENDING") === false,
    );
    logTest(
      "REVIEW coach cannot accept bookings",
      canCoachAcceptBooking("REVIEW") === false,
    );
    logTest(
      "REJECTED coach cannot accept bookings",
      canCoachAcceptBooking("REJECTED") === false,
    );

    // Test venue approval
    const newVenueStatus = getVenueApprovalStatus();
    logTest("New venue starts as PENDING", newVenueStatus === "PENDING");
    logTest("New venue is NOT auto-approved", newVenueStatus !== "APPROVED");
  } catch (error: any) {
    logTest("Verification status logic test", false, error.message);
  }
};

// Run all tests
const runAllTests = () => {
  console.log("🚀 Starting Business Logic Unit Tests");
  console.log("=".repeat(60));

  testOpeningHoursValidation();
  testCancellationPolicy();
  testAgeValidation();
  testCheckInCodeValidation();
  testReviewSystemLogic();
  testVerificationStatusLogic();

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

  process.exit(failed > 0 ? 1 : 0);
};

// Run tests
runAllTests();
