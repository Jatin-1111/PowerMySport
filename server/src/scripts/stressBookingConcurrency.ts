import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { connectDB } from "../config/database";
import { Booking } from "../models/Booking";
import { BookingSlotLock } from "../models/BookingSlotLock";
import { Coach } from "../models/Coach";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import {
  cancelBooking,
  checkInBookingByCode,
  confirmMockPaymentSuccess,
  initiateBooking,
} from "../services/BookingService";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type RaceResult = {
  name: string;
  passed: boolean;
  details: string;
};

type ScriptConfig = {
  iterations: number;
  slotAttempts: number;
  paymentAttempts: number;
  cancelAttempts: number;
  checkInAttempts: number;
  verbose: boolean;
};

type TestContext = {
  ownerId: string;
  adminId: string;
  coachId: string;
  venueOneId: string;
  venueTwoId: string;
  playerIds: string[];
};

type TestRunner = (ctx: TestContext) => Promise<RaceResult>;

const unique = (): string =>
  `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

const makePhone = (): string => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
  return `9${suffix.slice(0, 9)}`;
};

const makeFutureDate = (daysAhead: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toHHmm = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const config: ScriptConfig = {
  iterations: parsePositiveInt(process.env.RACE_ITERATIONS, 8),
  slotAttempts: parsePositiveInt(process.env.RACE_SLOT_ATTEMPTS, 8),
  paymentAttempts: parsePositiveInt(process.env.RACE_PAYMENT_ATTEMPTS, 12),
  cancelAttempts: parsePositiveInt(process.env.RACE_CANCEL_ATTEMPTS, 10),
  checkInAttempts: parsePositiveInt(process.env.RACE_CHECKIN_ATTEMPTS, 10),
  verbose: process.env.RACE_VERBOSE === "true",
};

const activeStatuses = ["CONFIRMED", "IN_PROGRESS"] as const;

const printResult = (result: RaceResult): void => {
  const icon = result.passed ? "✅" : "❌";
  console.log(`${icon} ${result.name}: ${result.details}`);
};

const pickPlayer = (playerIds: string[], index: number): string => {
  return playerIds[index % playerIds.length] || playerIds[0] || "";
};

const runCase = async (name: string, runner: TestRunner, ctx: TestContext) => {
  const startedAt = Date.now();
  try {
    const result = await runner(ctx);
    const durationMs = Date.now() - startedAt;
    return {
      ...result,
      name,
      details: `${result.details}; durationMs=${durationMs}`,
    } satisfies RaceResult;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return {
      name,
      passed: false,
      details: `exception=${message}; durationMs=${durationMs}`,
    } satisfies RaceResult;
  }
};

const venueSlotRaceCase = async (ctx: TestContext): Promise<RaceResult> => {
  let totalRuns = 0;
  let passedRuns = 0;

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    const bookingDate = makeFutureDate(2 + Math.floor(iteration / 8));
    const baseHour = 7 + (iteration % 8);
    const startTime = `${String(baseHour).padStart(2, "0")}:00`;
    const endTime = `${String(baseHour + 1).padStart(2, "0")}:00`;

    const raceResults = await Promise.allSettled(
      Array.from({ length: config.slotAttempts }, (_, index) =>
        initiateBooking({
          userId: pickPlayer(
            ctx.playerIds,
            iteration * config.slotAttempts + index,
          ),
          venueId: ctx.venueOneId,
          sport: "Badminton",
          date: bookingDate,
          startTime,
          endTime,
        }),
      ),
    );

    const successCount = raceResults.filter(
      (item) => item.status === "fulfilled",
    ).length;
    const failureCount = raceResults.filter(
      (item) => item.status === "rejected",
    ).length;

    const dbCount = await Booking.countDocuments({
      venueId: ctx.venueOneId,
      date: {
        $gte: new Date(
          bookingDate.getFullYear(),
          bookingDate.getMonth(),
          bookingDate.getDate(),
        ),
        $lt: new Date(
          bookingDate.getFullYear(),
          bookingDate.getMonth(),
          bookingDate.getDate() + 1,
        ),
      },
      startTime,
      endTime,
      status: { $in: activeStatuses },
    });

    totalRuns += 1;
    if (
      successCount === 1 &&
      failureCount === config.slotAttempts - 1 &&
      dbCount === 1
    ) {
      passedRuns += 1;
    }
  }

  return {
    name: "",
    passed: passedRuns === totalRuns,
    details: `passedRuns=${passedRuns}/${totalRuns}, attemptsPerRun=${config.slotAttempts}`,
  };
};

const coachSlotRaceCase = async (ctx: TestContext): Promise<RaceResult> => {
  let totalRuns = 0;
  let passedRuns = 0;

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    const bookingDate = makeFutureDate(5 + Math.floor(iteration / 8));
    const baseHour = 8 + (iteration % 8);
    const startTime = `${String(baseHour).padStart(2, "0")}:00`;
    const endTime = `${String(baseHour + 1).padStart(2, "0")}:00`;

    const raceResults = await Promise.allSettled(
      Array.from({ length: config.slotAttempts }, (_, index) =>
        initiateBooking({
          userId: pickPlayer(
            ctx.playerIds,
            iteration * config.slotAttempts + index,
          ),
          venueId: index % 2 === 0 ? ctx.venueOneId : ctx.venueTwoId,
          coachId: ctx.coachId,
          sport: "Badminton",
          date: bookingDate,
          startTime,
          endTime,
        }),
      ),
    );

    const successCount = raceResults.filter(
      (item) => item.status === "fulfilled",
    ).length;
    const failureCount = raceResults.filter(
      (item) => item.status === "rejected",
    ).length;

    const dbCount = await Booking.countDocuments({
      coachId: ctx.coachId,
      date: {
        $gte: new Date(
          bookingDate.getFullYear(),
          bookingDate.getMonth(),
          bookingDate.getDate(),
        ),
        $lt: new Date(
          bookingDate.getFullYear(),
          bookingDate.getMonth(),
          bookingDate.getDate() + 1,
        ),
      },
      startTime,
      endTime,
      status: { $in: activeStatuses },
    });

    totalRuns += 1;
    if (
      successCount === 1 &&
      failureCount === config.slotAttempts - 1 &&
      dbCount === 1
    ) {
      passedRuns += 1;
    }
  }

  return {
    name: "",
    passed: passedRuns === totalRuns,
    details: `passedRuns=${passedRuns}/${totalRuns}, attemptsPerRun=${config.slotAttempts}`,
  };
};

const boundaryBackToBackCase = async (
  ctx: TestContext,
): Promise<RaceResult> => {
  const bookingDate = makeFutureDate(9);
  const userA = pickPlayer(ctx.playerIds, 0);
  const userB = pickPlayer(ctx.playerIds, 1);

  const results = await Promise.allSettled([
    initiateBooking({
      userId: userA,
      venueId: ctx.venueOneId,
      sport: "Badminton",
      date: bookingDate,
      startTime: "17:00",
      endTime: "18:00",
    }),
    initiateBooking({
      userId: userB,
      venueId: ctx.venueOneId,
      sport: "Badminton",
      date: bookingDate,
      startTime: "18:00",
      endTime: "19:00",
    }),
  ]);

  const successCount = results.filter(
    (item) => item.status === "fulfilled",
  ).length;
  const failureCount = results.filter(
    (item) => item.status === "rejected",
  ).length;

  return {
    name: "",
    passed: successCount === 2 && failureCount === 0,
    details: `success=${successCount}, failed=${failureCount}`,
  };
};

const cancelRaceCase = async (ctx: TestContext): Promise<RaceResult> => {
  const bookingDate = makeFutureDate(10);
  const booking = await initiateBooking({
    userId: pickPlayer(ctx.playerIds, 2),
    venueId: ctx.venueOneId,
    sport: "Badminton",
    date: bookingDate,
    startTime: "13:00",
    endTime: "14:00",
  });

  const cancelResults = await Promise.allSettled(
    Array.from({ length: config.cancelAttempts }, () =>
      cancelBooking(booking.booking._id.toString()),
    ),
  );

  const nonNullCancels = cancelResults.filter(
    (item) => item.status === "fulfilled" && item.value,
  ).length;

  const refreshed = await Booking.findById(booking.booking._id);

  return {
    name: "",
    passed: nonNullCancels === 1 && refreshed?.status === "CANCELLED",
    details: `nonNullCancels=${nonNullCancels}, finalStatus=${refreshed?.status || "unknown"}`,
  };
};

const checkInRaceCase = async (ctx: TestContext): Promise<RaceResult> => {
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const booking = await initiateBooking({
    userId: pickPlayer(ctx.playerIds, 3),
    venueId: ctx.venueOneId,
    sport: "Badminton",
    date: start,
    startTime: toHHmm(start),
    endTime: toHHmm(end),
  });

  const bookingWithCode = await Booking.findById(booking.booking._id).select(
    "+checkInCode",
  );

  if (!bookingWithCode?.checkInCode) {
    return {
      name: "",
      passed: false,
      details: "booking checkInCode unavailable",
    };
  }

  const checkInResults = await Promise.allSettled(
    Array.from({ length: config.checkInAttempts }, () =>
      checkInBookingByCode(
        bookingWithCode.checkInCode as string,
        ctx.adminId,
        "ADMIN",
      ),
    ),
  );

  const successCount = checkInResults.filter(
    (item) => item.status === "fulfilled",
  ).length;
  const failureCount = checkInResults.filter(
    (item) => item.status === "rejected",
  ).length;

  const refreshed = await Booking.findById(booking.booking._id);

  return {
    name: "",
    passed:
      successCount === 1 &&
      failureCount === config.checkInAttempts - 1 &&
      refreshed?.status === "IN_PROGRESS",
    details: `success=${successCount}, failed=${failureCount}, finalStatus=${refreshed?.status || "unknown"}`,
  };
};

const mockPaymentRaceCase = async (ctx: TestContext): Promise<RaceResult> => {
  const bookingDate = makeFutureDate(11);
  const userId = pickPlayer(ctx.playerIds, 4);

  const booking = await initiateBooking({
    userId,
    venueId: ctx.venueOneId,
    sport: "Badminton",
    date: bookingDate,
    startTime: "20:00",
    endTime: "21:00",
  });

  const raceResults = await Promise.allSettled(
    Array.from({ length: config.paymentAttempts }, () =>
      confirmMockPaymentSuccess(booking.booking._id.toString(), userId),
    ),
  );

  const rejectedCount = raceResults.filter(
    (item) => item.status === "rejected",
  ).length;
  const refreshed = await Booking.findById(booking.booking._id).select(
    "+checkInCode",
  );

  const hasPaymentTimestamp = Boolean(refreshed?.paymentConfirmedAt);
  const hasEmailTimestamp = Boolean(refreshed?.confirmationEmailSentAt);

  return {
    name: "",
    passed: rejectedCount === 0 && hasPaymentTimestamp && hasEmailTimestamp,
    details: `rejected=${rejectedCount}, paymentConfirmedAt=${hasPaymentTimestamp}, confirmationEmailSentAt=${hasEmailTimestamp}`,
  };
};

const unauthorizedPaymentCase = async (
  ctx: TestContext,
): Promise<RaceResult> => {
  const bookingDate = makeFutureDate(12);
  const bookingOwner = pickPlayer(ctx.playerIds, 5);
  const wrongUser = pickPlayer(ctx.playerIds, 6);

  const booking = await initiateBooking({
    userId: bookingOwner,
    venueId: ctx.venueOneId,
    sport: "Badminton",
    date: bookingDate,
    startTime: "14:00",
    endTime: "15:00",
  });

  let rejected = false;
  try {
    await confirmMockPaymentSuccess(booking.booking._id.toString(), wrongUser);
  } catch {
    rejected = true;
  }

  return {
    name: "",
    passed: rejected,
    details: `unauthorizedRejected=${rejected}`,
  };
};

const run = async (): Promise<void> => {
  const createdUserIds: string[] = [];
  const createdVenueIds: string[] = [];
  const createdCoachIds: string[] = [];
  const results: RaceResult[] = [];

  try {
    await connectDB();

    console.log("\n=== Booking Concurrency Stress Config ===");
    console.log(
      JSON.stringify(
        {
          iterations: config.iterations,
          slotAttempts: config.slotAttempts,
          paymentAttempts: config.paymentAttempts,
          cancelAttempts: config.cancelAttempts,
          checkInAttempts: config.checkInAttempts,
        },
        null,
        2,
      ),
    );

    const owner = await User.create({
      name: `Race Owner ${unique()}`,
      email: `race-owner-${unique()}@example.com`,
      phone: makePhone(),
      password: "password123",
      role: "VENUE_LISTER",
    });
    createdUserIds.push(owner._id.toString());

    const admin = await User.create({
      name: `Race Admin ${unique()}`,
      email: `race-admin-${unique()}@example.com`,
      phone: makePhone(),
      password: "password123",
      role: "ADMIN",
    });
    createdUserIds.push(admin._id.toString());

    const requiredPlayers = Math.max(config.slotAttempts + 2, 14);
    const playerIds: string[] = [];
    for (let index = 0; index < requiredPlayers; index += 1) {
      const player = await User.create({
        name: `Race Player ${index}-${unique()}`,
        email: `race-player-${index}-${unique()}@example.com`,
        phone: makePhone(),
        password: "password123",
        role: "PLAYER",
      });
      playerIds.push(player._id.toString());
      createdUserIds.push(player._id.toString());
    }

    const coachUser = await User.create({
      name: `Race Coach ${unique()}`,
      email: `race-coach-${unique()}@example.com`,
      phone: makePhone(),
      password: "password123",
      role: "COACH",
    });
    createdUserIds.push(coachUser._id.toString());

    const venueOne = await Venue.create({
      ownerName: owner.name,
      ownerEmail: owner.email,
      ownerPhone: owner.phone,
      ownerId: owner._id,
      emailVerified: true,
      name: `Race Venue One ${unique()}`,
      location: { type: "Point", coordinates: [77.5946, 12.9716] },
      sports: ["Badminton"],
      pricePerHour: 900,
      amenities: ["Lights"],
      address: "Race Street 1",
      description: "Race test venue 1",
      allowExternalCoaches: true,
      approvalStatus: "APPROVED",
      documents: [],
      hasCoaches: false,
      venueCoaches: [],
    });
    createdVenueIds.push(venueOne._id.toString());

    const venueTwo = await Venue.create({
      ownerName: owner.name,
      ownerEmail: owner.email,
      ownerPhone: owner.phone,
      ownerId: owner._id,
      emailVerified: true,
      name: `Race Venue Two ${unique()}`,
      location: { type: "Point", coordinates: [77.6046, 12.9816] },
      sports: ["Badminton"],
      pricePerHour: 950,
      amenities: ["Parking"],
      address: "Race Street 2",
      description: "Race test venue 2",
      allowExternalCoaches: true,
      approvalStatus: "APPROVED",
      documents: [],
      hasCoaches: false,
      venueCoaches: [],
    });
    createdVenueIds.push(venueTwo._id.toString());

    const coach = await Coach.create({
      userId: coachUser._id,
      bio: "Race test coach",
      certifications: [],
      sports: ["Badminton"],
      hourlyRate: 700,
      serviceMode: "OWN_VENUE",
      availability: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        startTime: "06:00",
        endTime: "23:00",
      })),
      isVerified: true,
      verificationStatus: "VERIFIED",
    });
    createdCoachIds.push(coach._id.toString());

    const context: TestContext = {
      ownerId: owner._id.toString(),
      adminId: admin._id.toString(),
      coachId: coach._id.toString(),
      venueOneId: venueOne._id.toString(),
      venueTwoId: venueTwo._id.toString(),
      playerIds,
    };

    const cases: Array<{ name: string; runner: TestRunner }> = [
      { name: "Venue slot race", runner: venueSlotRaceCase },
      { name: "Coach slot race", runner: coachSlotRaceCase },
      { name: "Boundary back-to-back slots", runner: boundaryBackToBackCase },
      { name: "Cancel race (CAS)", runner: cancelRaceCase },
      { name: "Check-in race (CAS)", runner: checkInRaceCase },
      { name: "Mock payment idempotency", runner: mockPaymentRaceCase },
      { name: "Unauthorized mock payment", runner: unauthorizedPaymentCase },
    ];

    for (const testCase of cases) {
      const result = await runCase(testCase.name, testCase.runner, context);
      results.push(result);
      if (config.verbose) {
        printResult(result);
      }
    }

    console.log("\n=== Booking Concurrency Stress Report ===");
    if (!config.verbose) {
      results.forEach(printResult);
    }

    const allPassed = results.every((item) => item.passed);
    const passCount = results.filter((item) => item.passed).length;
    console.log(`Summary: ${passCount}/${results.length} checks passed`);

    if (!allPassed) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Stress script failed:", message);
    if (message.includes("Transaction numbers are only allowed")) {
      console.error(
        "ℹ️ This test requires MongoDB transactions (replica set / Atlas cluster).",
      );
    }
    process.exitCode = 1;
  } finally {
    await Booking.deleteMany({
      $or: [
        { venueId: { $in: createdVenueIds } },
        { userId: { $in: createdUserIds } },
        { coachId: { $in: createdCoachIds } },
      ],
    });

    await BookingSlotLock.deleteMany({
      resourceId: {
        $in: [
          ...createdVenueIds.map((id) => new mongoose.Types.ObjectId(id)),
          ...createdCoachIds.map((id) => new mongoose.Types.ObjectId(id)),
        ],
      },
    });

    if (createdCoachIds.length > 0) {
      await Coach.deleteMany({ _id: { $in: createdCoachIds } });
    }
    if (createdVenueIds.length > 0) {
      await Venue.deleteMany({ _id: { $in: createdVenueIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    await mongoose.disconnect();
  }
};

void run();
