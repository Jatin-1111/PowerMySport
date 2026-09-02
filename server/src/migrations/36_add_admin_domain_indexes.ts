import "dotenv/config";
import mongoose from "mongoose";
import { Dispute } from "../client/models/Dispute";
import { ConciergeRequest } from "../shared/models/ConciergeRequest";
import { Coach } from "../client/models/Coach";
import { User } from "../client/models/User";
import { CommunityReport } from "../community/models/CommunityReport";
import { Booking } from "../client/models/Booking";
import { TournamentEdition } from "../shared/models/TournamentEdition";

/**
 * Migration 36: add indexes found during the admin-backend performance audit
 * (the sibling to migrations 34/35, which covered the client backend).
 *
 * Every index here backs an admin list/dashboard endpoint that had no
 * supporting index for its actual filter+sort shape — mostly bare
 * {createdAt:-1}/{updatedAt:-1} sorts that fell back to a full collection
 * scan plus in-memory sort. Purely additive — no existing index is dropped.
 *
 * Idempotent: each index is checked by key shape (not by an assumed default
 * name) before creating it.
 *
 * USAGE
 *   npm run migrate:admin-domain-indexes                # dry run (default)
 *   npm run migrate:admin-domain-indexes -- --apply      # create missing indexes
 *   npm run migrate:admin-domain-indexes -- --down --apply   # drop the new ones
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
    label: "Dispute: createdAt (admin listDisputes, unfiltered)",
    model: Dispute,
    spec: { createdAt: -1 },
  },
  {
    label: "ConciergeRequest: status+createdAt (admin getPendingCounts + list, filtered)",
    model: ConciergeRequest,
    spec: { status: 1, createdAt: -1 },
  },
  {
    label: "ConciergeRequest: createdAt (admin getAllConciergeRequests, unfiltered)",
    model: ConciergeRequest,
    spec: { createdAt: -1 },
  },
  {
    label: "Coach: verificationStatus+createdAt (admin listCoaches, filtered)",
    model: Coach,
    spec: { verificationStatus: 1, createdAt: -1 },
  },
  {
    label: "Coach: createdAt (admin listCoaches, unfiltered)",
    model: Coach,
    spec: { createdAt: -1 },
  },
  {
    label: "User: role+updatedAt (admin listUsersForSafety, no isActive filter)",
    model: User,
    spec: { role: 1, updatedAt: -1 },
  },
  {
    label: "User: role+isActive+updatedAt (admin listUsersForSafety, filtered)",
    model: User,
    spec: { role: 1, isActive: 1, updatedAt: -1 },
  },
  {
    label: "CommunityReport: status+createdAt (admin listCommunityReports)",
    model: CommunityReport,
    spec: { status: 1, createdAt: -1 },
  },
  {
    label: "Booking: refundStatus+updatedAt (admin listRefunds)",
    model: Booking,
    spec: { refundStatus: 1, updatedAt: -1 },
  },
  {
    label: "Booking: createdAt (admin getAllBookings, unfiltered)",
    model: Booking,
    spec: { createdAt: -1 },
  },
  {
    label: "TournamentEdition: sportSlug+lastCheckedAt (admin getCalendarFreshness)",
    model: TournamentEdition,
    spec: { sportSlug: 1, lastCheckedAt: -1 },
  },
];

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 36: add admin domain indexes (${apply ? "APPLY" : "DRY RUN"})...`,
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
    const name = Object.entries(target.spec)
      .map(([k, d]) => `${k}_${d}`)
      .join("_");
    await collection.createIndex(target.spec, { name });
  }

  console.log(apply ? "Migration 36 complete." : "Dry run complete — re-run with --apply.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Reverting migration 36 (${apply ? "APPLY" : "DRY RUN"}) — dropping these indexes...`,
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
      console.error("Migration 36 failed:", error);
      process.exit(1);
    });
}
