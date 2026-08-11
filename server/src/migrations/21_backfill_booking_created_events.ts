import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { Booking } from "../client/models/Booking";
import { ExpertSession } from "../client/models/ExpertBooking";
import { BookingEvent } from "../client/models/BookingEvent";
import { providerDimensionsForBooking } from "../client/services/BookingEventService";

/**
 * Migration 21: Backfill a genesis CREATED event for every pre-existing
 * booking and expert session.
 *
 * The audit log introduced in Phase 1 only fills forward, so every booking
 * that predates it has an empty timeline. This gives each one a single
 * CREATED event so its history starts somewhere instead of reading as
 * "nothing ever happened".
 *
 * WHAT IS REAL AND WHAT IS NOT
 * ----------------------------
 * Only facts actually stored on the booking are copied:
 *   occurredAt   <- createdAt          (real)
 *   actorUserId  <- userId             (real — whose booking it is)
 *   amountPaise  <- totalAmount / amount, converted   (real)
 *   providerType <- venue/coach/academy/expert        (real)
 *
 * Everything the old schema never recorded is left ABSENT rather than guessed:
 *   channel   -> "BACKFILL", because the real surface is unknowable.
 *   toStatus  -> OMITTED. The document's *current* status is not the status it
 *                had at creation, and writing today's value into a creation
 *                event would be a fabrication that later analysis could not
 *                detect. The current status goes in metadata.statusAtBackfill
 *                instead, clearly labelled as an observation from backfill
 *                time rather than from creation time.
 *
 * THIS MIGRATION CANNOT BE ROLLED BACK
 * ------------------------------------
 * BookingEvent is append-only by design — deletes are blocked at the schema
 * level, so there is deliberately no down(). A wrong backfill is permanent.
 * That is why it dry-runs by default, refuses to write a second event for a
 * subject that already has one, and writes a report of exactly what it
 * inserted.
 *
 * USAGE
 * -----
 *   npm run migrate:backfill-booking-events              # dry run (default)
 *   npm run migrate:backfill-booking-events -- --apply   # write
 */

const BATCH_SIZE = 500;

interface PlannedEvent {
  subjectType: "BOOKING" | "EXPERT_SESSION";
  subjectId: string;
  providerType: string;
  occurredAt: string;
  amountPaise: number;
  statusAtBackfill: string;
}

interface SkippedSubject {
  subjectType: "BOOKING" | "EXPERT_SESSION";
  subjectId: string;
  reason: string;
}

const toPaise = (rupees: number): number =>
  Number.isFinite(rupees) && rupees > 0 ? Math.round(rupees * 100) : 0;

/**
 * Subjects that already have a CREATED event, so a re-run adds nothing.
 * Checked in one query rather than per-document: the events are undeletable,
 * so the duplicate check must not be the thing that flakes.
 */
const loadAlreadyBackfilled = async (
  subjectType: "BOOKING" | "EXPERT_SESSION",
  subjectIds: mongoose.Types.ObjectId[],
): Promise<Set<string>> => {
  if (subjectIds.length === 0) return new Set();

  const existing = await BookingEvent.find({
    subjectType,
    subjectId: { $in: subjectIds },
    type: "CREATED",
  })
    .select("subjectId")
    .lean<{ subjectId: mongoose.Types.ObjectId }[]>();

  return new Set(existing.map((event) => event.subjectId.toString()));
};

export const up = async (options: { apply?: boolean } = {}) => {
  const apply = Boolean(options.apply);

  console.log(
    `Starting migration 21: backfill CREATED events (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  const planned: PlannedEvent[] = [];
  const skipped: SkippedSubject[] = [];
  let inserted = 0;

  // ───────────── Booking (venue / coach / academy) ─────────────
  const bookings = await Booking.find({})
    .select("_id userId organizerId venueId coachId academyId status totalAmount sport date startTime endTime createdAt bookingType")
    .sort({ createdAt: 1 })
    .lean();

  console.log(`Found ${bookings.length} booking(s).`);

  const bookingsDone = await loadAlreadyBackfilled(
    "BOOKING",
    bookings.map((booking) => booking._id),
  );

  const bookingDocs: Record<string, unknown>[] = [];

  for (const booking of bookings) {
    const subjectId = booking._id.toString();

    if (bookingsDone.has(subjectId)) {
      skipped.push({
        subjectType: "BOOKING",
        subjectId,
        reason: "already has a CREATED event",
      });
      continue;
    }

    if (!booking.createdAt) {
      // Without createdAt there is no honest occurredAt to use, and dating the
      // event "now" would put a 2026 creation on a 2025 booking.
      skipped.push({
        subjectType: "BOOKING",
        subjectId,
        reason: "no createdAt — cannot date the event honestly",
      });
      continue;
    }

    const actorUserId = booking.organizerId ?? booking.userId;
    if (!actorUserId) {
      skipped.push({
        subjectType: "BOOKING",
        subjectId,
        reason: "no userId/organizerId — no actor to attribute",
      });
      continue;
    }

    const dimensions = providerDimensionsForBooking(booking);
    const amountPaise = toPaise(booking.totalAmount);

    bookingDocs.push({
      subjectType: "BOOKING",
      subjectId: booking._id,
      providerType: dimensions.providerType,
      ...(dimensions.providerId ? { providerId: dimensions.providerId } : {}),
      type: "CREATED",
      actorType: "USER",
      actorUserId,
      channel: "BACKFILL",
      ...(amountPaise > 0 ? { amountPaise } : {}),
      summary: `Booking created (reconstructed from the booking record — no live event was captured at the time)`,
      metadata: {
        backfilled: true,
        backfillMigration: "21_backfill_booking_created_events",
        // Labelled explicitly: this is the status as of the backfill, NOT the
        // status the booking had when it was created.
        statusAtBackfill: booking.status,
        bookingType: booking.bookingType ?? "INDIVIDUAL",
        sport: booking.sport,
        startTime: booking.startTime,
        endTime: booking.endTime,
      },
      occurredAt: booking.createdAt,
    });

    planned.push({
      subjectType: "BOOKING",
      subjectId,
      providerType: dimensions.providerType,
      occurredAt: new Date(booking.createdAt).toISOString(),
      amountPaise,
      statusAtBackfill: booking.status,
    });
  }

  // ───────────── ExpertSession ─────────────
  const sessions = await ExpertSession.find({})
    .select("_id expertId userId status amount scheduledAt mode createdAt")
    .sort({ createdAt: 1 })
    .lean();

  console.log(`Found ${sessions.length} expert session(s).`);

  const sessionsDone = await loadAlreadyBackfilled(
    "EXPERT_SESSION",
    sessions.map((session) => session._id),
  );

  const sessionDocs: Record<string, unknown>[] = [];

  for (const session of sessions) {
    const subjectId = session._id.toString();

    if (sessionsDone.has(subjectId)) {
      skipped.push({
        subjectType: "EXPERT_SESSION",
        subjectId,
        reason: "already has a CREATED event",
      });
      continue;
    }

    if (!session.createdAt) {
      skipped.push({
        subjectType: "EXPERT_SESSION",
        subjectId,
        reason: "no createdAt — cannot date the event honestly",
      });
      continue;
    }

    if (!session.userId) {
      skipped.push({
        subjectType: "EXPERT_SESSION",
        subjectId,
        reason: "no userId — no actor to attribute",
      });
      continue;
    }

    const amountPaise = toPaise(session.amount);

    sessionDocs.push({
      subjectType: "EXPERT_SESSION",
      subjectId: session._id,
      providerType: "EXPERT",
      ...(session.expertId ? { providerId: session.expertId } : {}),
      type: "CREATED",
      actorType: "USER",
      actorUserId: session.userId,
      channel: "BACKFILL",
      ...(amountPaise > 0 ? { amountPaise } : {}),
      summary: `Expert session created (reconstructed from the session record — no live event was captured at the time)`,
      metadata: {
        backfilled: true,
        backfillMigration: "21_backfill_booking_created_events",
        statusAtBackfill: session.status,
        mode: session.mode,
        scheduledAt: session.scheduledAt
          ? new Date(session.scheduledAt).toISOString()
          : null,
      },
      occurredAt: session.createdAt,
    });

    planned.push({
      subjectType: "EXPERT_SESSION",
      subjectId,
      providerType: "EXPERT",
      occurredAt: new Date(session.createdAt).toISOString(),
      amountPaise,
      statusAtBackfill: session.status,
    });
  }

  // ───────────── write ─────────────
  if (apply) {
    const allDocs = [...bookingDocs, ...sessionDocs];

    for (let start = 0; start < allDocs.length; start += BATCH_SIZE) {
      const batch = allDocs.slice(start, start + BATCH_SIZE);
      // ordered:false so one rejected document cannot abandon the rest of the
      // batch; every insert is independent.
      const result = await BookingEvent.insertMany(batch, { ordered: false });
      inserted += result.length;
      console.log(
        `  inserted ${inserted}/${allDocs.length} event(s)...`,
      );
    }
  }

  // ───────────── report ─────────────
  console.log();
  console.log("-".repeat(60));
  console.log(`Events to create : ${planned.length}`);
  console.log(`  bookings       : ${bookingDocs.length}`);
  console.log(`  expert sessions: ${sessionDocs.length}`);
  console.log(`Skipped          : ${skipped.length}`);
  if (apply) console.log(`Actually inserted: ${inserted}`);
  console.log("-".repeat(60));

  if (skipped.length > 0) {
    console.log();
    console.log("SKIPPED:");
    for (const row of skipped) {
      console.log(`  ${row.subjectType} ${row.subjectId} — ${row.reason}`);
    }
  }

  if (apply && inserted > 0) {
    const reportPath = path.join(
      process.cwd(),
      `migration-21-backfill-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ planned, skipped, inserted }, null, 2),
    );
    console.log();
    console.log(`Report written to ${reportPath}`);
    console.log(
      "Keep it: these events CANNOT be deleted, so this file is the only record of what this run added.",
    );
  }

  if (!apply) {
    console.log();
    console.log("Dry run — nothing was written. Re-run with --apply to commit.");
    console.log(
      "Note: BookingEvent is append-only. Applying this is IRREVERSIBLE.",
    );
  }

  console.log();
  console.log("Migration 21 completed.");

  return { planned, skipped, inserted };
};

/**
 * Intentionally absent. BookingEvent blocks deletes at the schema level, so
 * there is no way to undo this migration — and offering a down() that silently
 * did nothing would be worse than not having one.
 */
export const down = async () => {
  throw new Error(
    "Migration 21 cannot be rolled back: BookingEvent is append-only and blocks deletes. " +
      "Backfilled events are identifiable by channel:'BACKFILL' and metadata.backfilled === true " +
      "if you need to filter them out of a query.",
  );
};

// Run if executed directly
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/powermysport";

  const apply = process.argv.includes("--apply");

  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log("Connected to MongoDB");
      await up({ apply });
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
