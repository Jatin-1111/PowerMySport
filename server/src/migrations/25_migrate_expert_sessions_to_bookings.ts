import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { Booking } from "../client/models/Booking";
import { ExpertSession } from "../client/models/ExpertBooking";
import { Review } from "../client/models/Review";
import { Expert } from "../client/models/ExpertProfile";
import { Player } from "../client/models/Player";
import { User } from "../client/models/User";
import {
  EXPERT_BOOKING_SPORT,
  deriveSlotFromInstant,
  mapExpertCanceller,
  mapExpertStatusToBookingStatus,
  slotCrossesMidnightIST,
} from "../utils/expertSessionMapping";

/**
 * Migration 25: Move ExpertSession documents into the unified Booking model.
 *
 * Expert consultations were the one provider type stored in a separate
 * collection with its own status machine. This copies them into `bookings` as
 * `providerType: "EXPERT"` records, and lifts inline reviews out onto the
 * shared `Review` model where every other provider type's reviews already live.
 *
 * FIELD MAPPING
 * -------------
 * Core, shared with every booking:
 *   amount (rupees)      -> totalAmount (rupees; Booking is rupee-denominated)
 *   status + acceptance  -> status        (see mapExpertStatusToBookingStatus)
 *   expertAcceptance     -> providerAcceptance
 *   expertRespondedAt    -> providerRespondedAt
 *   paidAt               -> paymentConfirmedAt
 *   holdExpiresAt        -> expiresAt
 *   cancelledBy          -> cancelledBy   (EXPERT is renamed PROVIDER)
 *   cancelReason         -> cancellationReason
 *   playerId             -> participantId
 *   scheduledAt          -> scheduledAt (authoritative) + derived date/start/end
 *
 * Expert-only state goes into the `expert` subdocument. Reviews become Review
 * documents. Nothing is dropped silently — anything unmapped is reported.
 *
 * WHY date/startTime/endTime ARE DERIVED
 * --------------------------------------
 * Booking requires all three, and every slot, listing and conflict query reads
 * them. ExpertSession only ever stored an instant. The instant stays
 * authoritative on `scheduledAt`; these are filled in from it so the existing
 * queries work. A session with no scheduledAt at all cannot produce them, so it
 * is reported rather than given a fabricated slot.
 *
 * IDEMPOTENT: a session already migrated (a Booking exists carrying its id in
 * `expert.legacySessionId`) is skipped. Safe to re-run.
 *
 * REVERSIBLE: down() deletes the Bookings and Reviews this migration created,
 * identified by that same marker. The original ExpertSession documents are
 * never modified or deleted by up(), so the old collection remains the fallback
 * until you explicitly drop it.
 *
 * USAGE
 *   npm run migrate:expert-sessions              # dry run (default)
 *   npm run migrate:expert-sessions -- --apply
 *   npm run migrate:expert-sessions -- --down --apply
 */

interface MigratedRow {
  sessionId: string;
  bookingId: string;
  fromStatus: string;
  toStatus: string;
  reviewId?: string;
}

interface SkippedRow {
  sessionId: string;
  reason: string;
}


export const up = async (
  options: { apply?: boolean; report?: boolean } = {},
) => {
  const apply = Boolean(options.apply);
  // Only the CLI writes a report file. Called programmatically (tests, or from
  // another migration) it should stay a pure function of the database — writing
  // files as a side effect of a library call litters the package root.
  const writeReport = Boolean(options.report);

  console.log(
    `Starting migration 25: ExpertSession -> Booking (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  const sessions = await ExpertSession.find({}).sort({ createdAt: 1 }).lean();
  console.log(`Found ${sessions.length} expert session(s).`);

  // One query rather than per-session: the marker lives inside the expert
  // subdocument, so this is the only reliable "already migrated" signal.
  const existing = await Booking.find({
    providerType: "EXPERT",
    "expert.legacySessionId": { $in: sessions.map((s) => s._id.toString()) },
  })
    .select("expert.legacySessionId")
    .lean<Array<{ expert?: { legacySessionId?: string } }>>();
  const alreadyMigrated = new Set(
    existing.map((b) => b.expert?.legacySessionId).filter(Boolean) as string[],
  );

  const migrated: MigratedRow[] = [];
  const skipped: SkippedRow[] = [];
  const warnings: string[] = [];

  // Expert -> owning user, needed for the payout payee entry.
  const expertIds = [...new Set(sessions.map((s) => String(s.expertId)))];
  const experts = await Expert.find({ _id: { $in: expertIds } })
    .select("_id userId")
    .lean<Array<{ _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId }>>();
  const expertUserById = new Map(
    experts.map((e) => [e._id.toString(), e.userId?.toString()]),
  );

  // Booking.participantName is who the session is FOR — the child when the
  // parent picked one, otherwise the booking user. ExpertSession never stored
  // a name, only ids, so it is resolved here rather than left blank (the admin
  // booking table renders this column).
  const playerIds = sessions.map((s) => s.playerId).filter(Boolean);
  const players = await Player.find({ _id: { $in: playerIds } })
    .select("_id name")
    .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>();
  const playerNameById = new Map(
    players.map((p) => [p._id.toString(), p.name ?? ""]),
  );

  const userIds = [...new Set(sessions.map((s) => String(s.userId)))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name")
    .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>();
  const userNameById = new Map(users.map((u) => [u._id.toString(), u.name ?? ""]));

  for (const session of sessions) {
    const sessionId = session._id.toString();

    if (alreadyMigrated.has(sessionId)) {
      skipped.push({ sessionId, reason: "already migrated" });
      continue;
    }

    if (!session.scheduledAt) {
      // Booking requires date/startTime/endTime and there is nothing honest to
      // derive them from. Inventing a slot would put a fake time on a real
      // record, so these are surfaced for a human instead.
      skipped.push({
        sessionId,
        reason: "no scheduledAt — cannot derive the required date/start/end",
      });
      continue;
    }

    const duration = session.durationMinutes || 60;
    const scheduledAt = new Date(session.scheduledAt);
    const slot = deriveSlotFromInstant(scheduledAt, duration);

    if (slotCrossesMidnightIST(scheduledAt, duration)) {
      warnings.push(
        `session ${sessionId}: crosses IST midnight — endTime clamped to ${slot.endTime}`,
      );
    }

    const bookingStatus = mapExpertStatusToBookingStatus(session as never);
    const expertUserId = expertUserById.get(String(session.expertId));

    if (!expertUserId) {
      warnings.push(
        `session ${sessionId}: expert ${session.expertId} has no owning user — no payout payee will be recorded`,
      );
    }

    // Payee/payer entries mirroring what a venue/coach booking carries, so the
    // shared payout job can see expert bookings at all.
    const payments: Array<Record<string, unknown>> = [];
    if (expertUserId) {
      payments.push({
        userId: new mongoose.Types.ObjectId(expertUserId),
        userType: "Expert",
        amount: session.amount,
        status: session.payoutStatus === "PAID" ? "PAID" : "PENDING",
        ...(session.payoutPaidAt ? { paidAt: session.payoutPaidAt } : {}),
      });
    }
    payments.push({
      userId: session.userId,
      userType: "Player",
      amount: session.amount,
      status: session.paymentStatus === "COMPLETED" ? "PAID" : "PENDING",
      ...(session.paidAt ? { paidAt: session.paidAt } : {}),
    });

    const bookingDoc: Record<string, unknown> = {
      userId: session.userId,
      organizerId: session.userId,
      expertId: session.expertId,
      providerType: "EXPERT",
      sport: EXPERT_BOOKING_SPORT,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      scheduledAt,
      durationMinutes: duration,
      totalAmount: session.amount,
      status: bookingStatus,
      participantName:
        (session.playerId
          ? playerNameById.get(String(session.playerId))
          : undefined) ||
        userNameById.get(String(session.userId)) ||
        "Client",
      ...(session.playerId ? { participantId: session.playerId } : {}),
      ...(session.paidAt ? { paymentConfirmedAt: session.paidAt } : {}),
      ...(session.holdExpiresAt ? { expiresAt: session.holdExpiresAt } : {}),
      ...(session.expertAcceptance
        ? { providerAcceptance: session.expertAcceptance }
        : {}),
      ...(session.expertRespondedAt
        ? { providerRespondedAt: session.expertRespondedAt }
        : {}),
      ...(session.completedAt ? { completedAt: session.completedAt } : {}),
      ...(session.cancelledAt ? { cancelledAt: session.cancelledAt } : {}),
      ...(session.cancelReason
        ? { cancellationReason: session.cancelReason }
        : {}),
      ...(mapExpertCanceller(session.cancelledBy)
        ? { cancelledBy: mapExpertCanceller(session.cancelledBy) }
        : {}),
      ...(typeof session.cancellationNoticeHours === "number"
        ? { cancellationNoticeHours: session.cancellationNoticeHours }
        : {}),
      bookingType: "INDIVIDUAL",
      paymentType: "SINGLE",
      payments,
      participants: [],
      expert: {
        legacySessionId: sessionId,
        ...(session.mode ? { mode: session.mode } : {}),
        ...(session.meetingLink ? { meetingLink: session.meetingLink } : {}),
        ...(session.clientNote ? { clientNote: session.clientNote } : {}),
        ...(session.momNotes ? { momNotes: session.momNotes } : {}),
        ...(session.momAddedAt ? { momAddedAt: session.momAddedAt } : {}),
        ...(session.autoCompleted ? { autoCompleted: session.autoCompleted } : {}),
        ...(session.refundStatus
          ? { manualRefundStatus: session.refundStatus }
          : {}),
        ...(session.merchantOrderId
          ? { merchantOrderId: session.merchantOrderId }
          : {}),
        ...(session.phonepeOrderId
          ? { phonepeOrderId: session.phonepeOrderId }
          : {}),
        ...(session.momReminderSentAt
          ? { momReminderSentAt: session.momReminderSentAt }
          : {}),
        ...(session.reviewReminderSentAt
          ? { reviewReminderSentAt: session.reviewReminderSentAt }
          : {}),
        ...(session.meetingLinkNudgeSentAt
          ? { meetingLinkNudgeSentAt: session.meetingLinkNudgeSentAt }
          : {}),
        ...(session.startReminderSentAt
          ? { startReminderSentAt: session.startReminderSentAt }
          : {}),
      },
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };

    const row: MigratedRow = {
      sessionId,
      bookingId: "(dry run)",
      fromStatus: session.status,
      toStatus: bookingStatus,
    };

    if (apply) {
      // Raw insert rather than the model: these documents carry historical
      // timestamps and a legacy marker, and must not be reshaped by defaults
      // or the providerType derivation hook on the way in.
      const { insertedId: created } = await Booking.collection.insertOne(
        bookingDoc as never,
      );
      row.bookingId = String(created);

      if (session.reviewed && typeof session.rating === "number") {
        const reviewDoc = {
          bookingId: created,
          userId: session.userId,
          targetType: "EXPERT",
          targetId: session.expertId,
          rating: session.rating,
          ...(session.review ? { review: session.review } : {}),
          isVerified: true,
          isAnonymous: Boolean(session.reviewAnonymous),
          isHidden: Boolean(session.reviewHidden),
          moderationStatus: "APPROVED",
          helpfulCount: 0,
          reportCount: 0,
          reports: [],
          createdAt: session.reviewedAt ?? session.updatedAt,
          updatedAt: session.updatedAt,
        };
        const inserted = await Review.collection.insertOne(reviewDoc as never);
        row.reviewId = String(inserted.insertedId);
      }
    } else if (session.reviewed) {
      row.reviewId = "(would create)";
    }

    migrated.push(row);
  }

  console.log();
  console.log("-".repeat(60));
  console.log(`Migrated : ${migrated.length}`);
  console.log(`Skipped  : ${skipped.length}`);
  console.log(`Reviews  : ${migrated.filter((r) => r.reviewId).length}`);
  console.log("-".repeat(60));

  for (const row of migrated) {
    console.log(
      `  ${row.sessionId}  ${row.fromStatus} -> ${row.toStatus}  booking=${row.bookingId}${
        row.reviewId ? `  review=${row.reviewId}` : ""
      }`,
    );
  }
  for (const row of skipped) {
    console.log(`  SKIPPED ${row.sessionId} — ${row.reason}`);
  }
  if (warnings.length > 0) {
    console.log();
    console.log("WARNINGS:");
    for (const w of warnings) console.log(`  ${w}`);
  }

  console.log();
  console.log(
    "NOTE: the original ExpertSession documents are left untouched. They remain " +
      "the fallback until the service cutover is verified and you drop them.",
  );

  if (apply && writeReport && migrated.length > 0) {
    const reportDir = path.join(process.cwd(), "migration-reports");
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(
      reportDir,
      `migration-25-expert-sessions-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ migrated, skipped, warnings }, null, 2),
    );
    console.log(`Report written to ${reportPath}`);
  }

  if (!apply) {
    console.log();
    console.log("Dry run — nothing was written. Re-run with --apply to commit.");
  }

  console.log();
  console.log("Migration 25 completed.");

  return { migrated, skipped, warnings };
};

export const down = async (options: { apply?: boolean } = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Rolling back migration 25 (${apply ? "APPLY" : "DRY RUN"})...`);

  const created = await Booking.find({
    providerType: "EXPERT",
    "expert.legacySessionId": { $exists: true },
  })
    .select("_id")
    .lean();

  console.log(`${created.length} migrated expert booking(s) would be removed.`);

  if (apply) {
    const ids = created.map((b) => b._id);
    const reviews = await Review.collection.deleteMany({
      bookingId: { $in: ids },
      targetType: "EXPERT",
    });
    const bookings = await Booking.collection.deleteMany({
      _id: { $in: ids },
    });
    console.log(
      `Deleted ${bookings.deletedCount} booking(s) and ${reviews.deletedCount} review(s).`,
    );
    console.log(
      "The original ExpertSession documents were never modified, so they are " +
        "still intact and authoritative.",
    );
  } else {
    console.log("Dry run — nothing was written.");
  }

  console.log("Rollback completed.");
};

// Run if executed directly
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/powermysport";

  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--down");

  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log("Connected to MongoDB");
      if (rollback) {
        await down({ apply });
      } else {
        await up({ apply, report: true });
      }
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
