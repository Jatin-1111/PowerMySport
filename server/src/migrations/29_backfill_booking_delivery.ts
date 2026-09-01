import "dotenv/config";
import mongoose from "mongoose";
import { Booking } from "../client/models/Booking";
import { Venue } from "../client/models/Venue";
import { Coach } from "../client/models/Coach";
import Academy from "../admin/models/Academy";

/**
 * Migration 29: Backfill `Booking.delivery` on existing documents.
 *
 * `delivery` records where a session is actually delivered, snapshotted at
 * creation. Existing bookings predate it, so consumers (invoice, emails) fall
 * back to the provider's live profile for them — the exact behaviour the field
 * exists to remove. This fills the field in wherever the answer is *recoverable
 * from stored data*.
 *
 * WHAT IS NOT RECOVERABLE, AND IS DELIBERATELY LEFT EMPTY
 *
 * Bookings with a FREELANCE/HYBRID coach and no venue were delivered at the
 * student's address — and that address was never persisted. `playerLocation`
 * was validated at booking time and then discarded. It is genuinely gone.
 *  
 * This migration does NOT invent a location for those (the coach's base
 * location is where the coach starts from, not where the session happened).
 * It counts them and reports them, and they keep `delivery` unset. Writing a
 * plausible-looking wrong address into a field that feeds tax invoices would be
 * worse than leaving it absent.
 *
 * A NOTE ON SNAPSHOT ACCURACY
 *
 * For the rows it can fill, the address comes from the provider's profile as it
 * stands *today*, not as it stood when the booking was made — that history does
 * not exist either. This is still strictly better than the status quo (which
 * re-reads that same live profile on every render, and reads the wrong field
 * entirely for coaches), and it freezes the value from here on.
 *
 * USAGE
 *   npm run migrate:booking-delivery                # dry run (default)
 *   npm run migrate:booking-delivery -- --apply     # write
 *   npm run migrate:booking-delivery -- --down      # unset the field again
 */

type Coordinates = [number, number];

const asCoordinates = (raw: unknown): Coordinates | undefined => {
  if (!Array.isArray(raw) || raw.length !== 2) return undefined;
  const [lng, lat] = raw as unknown[];
  if (typeof lng !== "number" || typeof lat !== "number") return undefined;
  if (Number.isNaN(lng) || Number.isNaN(lat)) return undefined;
  return [lng, lat];
};

const clean = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== null),
  ) as T;

export const up = async (options: { apply?: boolean } = {}) => {
  const apply = Boolean(options.apply);

  console.log(
    `Starting migration 29: backfill Booking.delivery (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  const bookings = await Booking.find({ delivery: { $exists: false } })
    .select("_id venueId coachId academyId")
    .lean();

  console.log(`Found ${bookings.length} booking(s) without delivery.`);

  if (bookings.length === 0) {
    console.log("Nothing to do.");
    return { planned: 0, counts: {}, unrecoverable: 0, modified: 0 };
  }

  // Load only the providers these bookings actually reference.
  const venueIds = new Set<string>();
  const coachIds = new Set<string>();
  const academyIds = new Set<string>();
  for (const b of bookings) {
    if (b.venueId) venueIds.add(b.venueId.toString());
    if (b.coachId) coachIds.add(b.coachId.toString());
    if (b.academyId) academyIds.add(b.academyId.toString());
  }

  const [venues, coaches, academies] = await Promise.all([
    Venue.find({ _id: { $in: [...venueIds] } })
      .select("_id name address location")
      .lean(),
    Coach.find({ _id: { $in: [...coachIds] } })
      .select("_id serviceMode ownVenueDetails")
      .lean(),
    Academy.find({ _id: { $in: [...academyIds] } })
      .select("_id name address city state pincode location")
      .lean(),
  ]);

  const venueById = new Map(venues.map((v: any) => [v._id.toString(), v]));
  const coachById = new Map(coaches.map((c: any) => [c._id.toString(), c]));
  const academyById = new Map(academies.map((a: any) => [a._id.toString(), a]));

  const counts: Record<string, number> = {};
  const operations: mongoose.AnyBulkWriteOperation[] = [];
  let unrecoverable = 0;
  let missingProvider = 0;
  // A venue booking can end up address-less two different ways — the venue row
  // was deleted, or the venue exists but has no address on file. They need very
  // different follow-up, so do not let the report blur them together.
  let venueDeleted = 0;
  let venueWithoutAddress = 0;

  for (const booking of bookings) {
    let delivery: Record<string, unknown> | undefined;

    if (booking.venueId) {
      const venue = venueById.get(booking.venueId.toString());
      if (venue) {
        if (!venue.address) venueWithoutAddress += 1;
        delivery = clean({
          kind: "PLATFORM_VENUE",
          venueId: booking.venueId,
          nameSnapshot: venue.name,
          addressSnapshot: venue.address,
          coordinates: asCoordinates(venue.location?.coordinates),
        });
      } else {
        // The venue row is gone; venueId alone still satisfies the kind.
        venueDeleted += 1;
        delivery = { kind: "PLATFORM_VENUE", venueId: booking.venueId };
      }
    } else if (booking.coachId) {
      const coach = coachById.get(booking.coachId.toString());
      if (!coach) {
        missingProvider += 1;
      } else if (coach.serviceMode === "OWN_VENUE") {
        delivery = clean({
          kind: "PROVIDER_VENUE",
          nameSnapshot: coach.ownVenueDetails?.name,
          addressSnapshot: coach.ownVenueDetails?.address,
          coordinates: asCoordinates(coach.ownVenueDetails?.location?.coordinates),
        });
      } else {
        // FREELANCE / HYBRID at the student's address — discarded at booking
        // time, unrecoverable. Left unset on purpose. See the header comment.
        unrecoverable += 1;
      }
    } else if (booking.academyId) {
      const academy = academyById.get(booking.academyId.toString());
      if (!academy) {
        missingProvider += 1;
      } else {
        const tail = [academy.city, academy.state, academy.pincode]
          .filter((p: unknown): p is string => Boolean(p && String(p).trim()))
          .join(", ");
        const addressSnapshot =
          [academy.address, tail]
            .filter((p): p is string => Boolean(p && p.trim()))
            .join(", ") || undefined;
        delivery = clean({
          kind: "PROVIDER_VENUE",
          nameSnapshot: academy.name,
          addressSnapshot,
          coordinates: asCoordinates(academy.location?.coordinates),
        });
      }
    } else {
      missingProvider += 1;
    }

    if (!delivery) continue;

    const key = `${delivery.kind}${delivery.addressSnapshot ? "" : " (no address)"}`;
    counts[key] = (counts[key] ?? 0) + 1;

    operations.push({
      updateOne: {
        filter: { _id: booking._id },
        update: { $set: { delivery } },
      },
    });
  }

  let modified = 0;
  if (apply && operations.length > 0) {
    // Raw collection on purpose: routing through the model would run full
    // document validation against legacy rows that may predate other required
    // fields, and this migration has no business failing on those.
    const result = await Booking.collection.bulkWrite(operations as never[], {
      ordered: false,
    });
    modified = result.modifiedCount ?? 0;
  }

  console.log();
  console.log("-".repeat(60));
  console.log(`To backfill      : ${operations.length}`);
  for (const [kind, count] of Object.entries(counts).sort()) {
    console.log(`  ${kind.padEnd(30)}: ${count}`);
  }
  console.log(
    `Unrecoverable    : ${unrecoverable}  (freelance/hybrid coach at the student's address — never stored)`,
  );
  if (venueDeleted > 0) {
    console.log(
      `Venue deleted    : ${venueDeleted}  (booking keeps venueId, no address to snapshot)`,
    );
  }
  if (venueWithoutAddress > 0) {
    console.log(
      `Venue no address : ${venueWithoutAddress}  (venue row exists but has no address on file — data quality)`,
    );
  }
  if (missingProvider > 0) {
    console.log(
      `Provider missing : ${missingProvider}  (coach/academy doc deleted; no delivery written)`,
    );
  }
  if (apply) console.log(`Modified         : ${modified}`);
  console.log("-".repeat(60));

  if (!apply) {
    console.log();
    console.log("Dry run — nothing was written. Re-run with --apply to commit.");
  }

  console.log();
  console.log("Migration 29 completed.");

  return { planned: operations.length, counts, unrecoverable, modified };
};

export const down = async (options: { apply?: boolean } = {}) => {
  const apply = Boolean(options.apply);

  console.log(`Rolling back migration 29 (${apply ? "APPLY" : "DRY RUN"})...`);

  const affected = await Booking.countDocuments({ delivery: { $exists: true } });
  console.log(`${affected} booking(s) currently carry delivery.`);
  console.log(
    "NOTE: this unsets delivery on ALL bookings, including ones written by the " +
      "application after the field shipped — not just the rows this migration " +
      "backfilled. Those are not recoverable by re-running up().",
  );

  if (apply) {
    const result = await Booking.collection.updateMany(
      { delivery: { $exists: true } },
      { $unset: { delivery: "" } },
    );
    console.log(`Unset delivery on ${result.modifiedCount} booking(s).`);
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
        await up({ apply });
      }
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
