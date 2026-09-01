import "dotenv/config";
import mongoose from "mongoose";
import { Venue } from "../client/models/Venue";
import { Coach } from "../client/models/Coach";
import { CoachOffering } from "../client/models/CoachOffering";
import { Booking } from "../client/models/Booking";
import { ExpertSession } from "../client/models/ExpertBooking";

/**
 * Migration 34: add indexes for query shapes discovered during a
 * performance audit of the "client" backend (booking, wallet, venue, coach,
 * experts, notifications, reviews, friends) — the sibling pass to the
 * community-backend audit that produced migrations 31-33.
 *
 * Every index here backs a public/high-traffic list or search endpoint that
 * previously had no supporting index for its actual filter+sort shape,
 * forcing an in-memory sort (or worse, a full collection scan) on every
 * request. Several come in pairs/sets because the query has one or more
 * OPTIONAL filter fields (e.g. `sport`) — a compound index can't serve a
 * sort past an unconstrained middle field, so "browse without that filter"
 * needs its own index rather than relying on a prefix of the filtered one.
 *
 * Purely additive — no existing index is dropped or altered, so there's no
 * drop-then-recreate step like migrations 27/32 needed.
 *
 * Idempotent: each index is checked by key shape (not by an assumed default
 * name) before creating it.
 *
 * USAGE
 *   npm run migrate:client-domain-indexes                # dry run (default)
 *   npm run migrate:client-domain-indexes -- --apply      # create missing indexes
 *   npm run migrate:client-domain-indexes -- --down --apply   # drop them again
 */

interface Options {
  apply?: boolean;
}

type IndexKeySpec = Record<string, 1 | -1>;

interface IndexTarget {
  label: string;
  model: mongoose.Model<any>;
  spec: IndexKeySpec;
}

const keysMatch = (a: Record<string, unknown>, b: IndexKeySpec): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((key, position) => aKeys[position] === key && a[key] === b[key]);
};

const TARGETS: IndexTarget[] = [
  {
    label: "Venue: approvalStatus+rating+reviewCount (no-sport-filter browse)",
    model: Venue,
    spec: { approvalStatus: 1, rating: -1, reviewCount: -1, _id: 1 },
  },
  {
    label: "Venue: approvalStatus+sports+rating+reviewCount (sport-filtered)",
    model: Venue,
    spec: { approvalStatus: 1, sports: 1, rating: -1, reviewCount: -1, _id: 1 },
  },
  {
    label: "Coach: isVerified+verificationStatus+rating+reviewCount (no-sport-filter)",
    model: Coach,
    spec: {
      isVerified: 1,
      verificationStatus: 1,
      rating: -1,
      reviewCount: -1,
      _id: 1,
    },
  },
  {
    label: "Coach: isVerified+verificationStatus+sports+rating+reviewCount (sport-filtered)",
    model: Coach,
    spec: {
      isVerified: 1,
      verificationStatus: 1,
      sports: 1,
      rating: -1,
      reviewCount: -1,
      _id: 1,
    },
  },
  {
    label: "CoachOffering: status+createdAt (no filter)",
    model: CoachOffering,
    spec: { status: 1, createdAt: -1 },
  },
  {
    label: "CoachOffering: status+sport+createdAt",
    model: CoachOffering,
    spec: { status: 1, sport: 1, createdAt: -1 },
  },
  {
    label: "CoachOffering: status+deliveryKind+createdAt",
    model: CoachOffering,
    spec: { status: 1, deliveryKind: 1, createdAt: -1 },
  },
  {
    label: "CoachOffering: status+sport+deliveryKind+createdAt",
    model: CoachOffering,
    spec: { status: 1, sport: 1, deliveryKind: 1, createdAt: -1 },
  },
  {
    label: "Booking: userId+createdAt ('my bookings' sort)",
    model: Booking,
    spec: { userId: 1, createdAt: -1 },
  },
  {
    label: "Booking: venueId+status+date (venue-lister dashboard)",
    model: Booking,
    spec: { venueId: 1, status: 1, date: -1 },
  },
  {
    label: "Booking: coachId+status+date (coach dashboard)",
    model: Booking,
    spec: { coachId: 1, status: 1, date: -1 },
  },
  {
    label: "ExpertSession: expertId+reviewed+reviewHidden+reviewedAt (public reviews)",
    model: ExpertSession,
    spec: { expertId: 1, reviewed: 1, reviewHidden: 1, reviewedAt: -1 },
  },
];

const nameFor = (spec: IndexKeySpec): string =>
  Object.entries(spec)
    .map(([key, dir]) => `${key}_${dir}`)
    .join("_");

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 34: add client-domain indexes (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  for (const target of TARGETS) {
    const collection = target.model.collection;
    const existing = await collection.indexes();
    const already = existing.some((index) => keysMatch(index.key || {}, target.spec));

    if (already) {
      console.log(`  [skip] ${target.label} — already present`);
      continue;
    }

    if (!apply) {
      console.log(`  [would create] ${target.label}`);
      continue;
    }

    console.log(`  [creating] ${target.label}...`);
    await collection.createIndex(target.spec, { name: nameFor(target.spec) });
  }

  console.log(apply ? "Migration 34 complete." : "Dry run complete — re-run with --apply.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Reverting migration 34 (${apply ? "APPLY" : "DRY RUN"}) — dropping these indexes...`,
  );

  for (const target of TARGETS) {
    const collection = target.model.collection;
    const existing = await collection.indexes();
    const match = existing.find((index) => keysMatch(index.key || {}, target.spec));

    if (!match || !match.name) {
      console.log(`  [skip] ${target.label} — not present`);
      continue;
    }

    if (!apply) {
      console.log(`  [would drop] ${target.label} (${match.name})`);
      continue;
    }

    console.log(`  [dropping] ${target.label} (${match.name})...`);
    await collection.dropIndex(match.name);
  }

  console.log(apply ? "Revert complete." : "Dry run complete — re-run with --down --apply.");
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };
  const isDown = argv.includes("--down");

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => (isDown ? down(options) : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 34 failed:", error);
      process.exit(1);
    });
}
