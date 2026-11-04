import "dotenv/config";
import mongoose from "mongoose";
import { PlanCheckIn } from "../shared/models/PlanCheckIn";
import { ScreeningRequest } from "../client/models/ScreeningRequest";
import { GuidanceSubmission } from "../client/models/GuidanceSubmission";
import { SupportTicket } from "../client/models/SupportTicket";
import { ScheduledNotification } from "../client/models/ScheduledNotification";
import { BookingEvent } from "../client/models/BookingEvent";
import { Review } from "../client/models/Review";
import { Expert } from "../client/models/ExpertProfile";
import FriendConnection from "../client/models/FriendConnection";

/**
 * Migration 35: add indexes found during the second, deeper pass of the
 * client-backend performance audit (the sibling to migration 34, which
 * covered the first pass — booking, wallet, venue, coach, experts).
 *
 * Every index here backs a per-user or admin list endpoint that had no
 * supporting index for its actual filter+sort shape. Several are pairs
 * because the query has an optional filter field — a compound index can't
 * serve a sort past an unconstrained middle field, so "without that filter"
 * needs its own index. The Review index replaces (not just adds to) its
 * predecessor, since the 3-field version is a strict superset of the 2-field
 * one for any query the old one served.
 *
 * Purely additive except for the one Review replacement — no other existing
 * index is dropped.
 *
 * Idempotent: each index is checked by key shape (not by an assumed default
 * name) before creating it. The Review replacement drops the superseded
 * 2-field index only if the new 3-field one isn't already present.
 *
 * USAGE
 *   npm run migrate:second-pass-client-indexes                # dry run (default)
 *   npm run migrate:second-pass-client-indexes -- --apply      # create missing indexes
 *   npm run migrate:second-pass-client-indexes -- --down --apply   # drop the new ones
 */

interface Options {
  apply?: boolean;
}

type IndexKeySpec = Record<string, 1 | -1>;

interface IndexTarget {
  label: string;
  model: mongoose.Model<any>;
  spec: IndexKeySpec;
  /** If set, this index (matched by key shape) is dropped once the new spec is confirmed present. */
  replaces?: IndexKeySpec;
}

const keysMatch = (a: Record<string, unknown>, b: IndexKeySpec): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((key, position) => aKeys[position] === key && a[key] === b[key]);
};

const TARGETS: IndexTarget[] = [
  {
    label: "PlanCheckIn: userId+status+checkInDueAt (listPlanCheckIns sort)",
    model: PlanCheckIn,
    spec: { userId: 1, status: 1, checkInDueAt: 1 },
  },
  {
    label: "ScreeningRequest: parentId+createdAt (getMyScreeningRequests)",
    model: ScreeningRequest,
    spec: { parentId: 1, createdAt: -1 },
  },
  {
    label: "ScreeningRequest: createdAt (admin list, no status filter)",
    model: ScreeningRequest,
    spec: { createdAt: -1 },
  },
  {
    label: "ScreeningRequest: status+createdAt (admin list, filtered)",
    model: ScreeningRequest,
    spec: { status: 1, createdAt: -1 },
  },
  {
    label: "GuidanceSubmission: userId+createdAt (getGuidanceHistory)",
    model: GuidanceSubmission,
    spec: { userId: 1, createdAt: -1 },
  },
  {
    label: "SupportTicket: userId+updatedAt (getMySupportTickets, no status filter)",
    model: SupportTicket,
    spec: { userId: 1, updatedAt: -1 },
  },
  {
    label: "SupportTicket: userId+status+updatedAt (getMySupportTickets, filtered)",
    model: SupportTicket,
    spec: { userId: 1, status: 1, updatedAt: -1 },
  },
  {
    label: "ScheduledNotification: userId+status+scheduledFor (getUserUpcomingReminders)",
    model: ScheduledNotification,
    spec: { userId: 1, status: 1, scheduledFor: 1 },
  },
  {
    label: "BookingEvent: subjectType+subjectId+occurredAt+createdAt (timeline, replaces 3-field)",
    model: BookingEvent,
    spec: { subjectType: 1, subjectId: 1, occurredAt: 1, createdAt: 1 },
    replaces: { subjectType: 1, subjectId: 1, occurredAt: 1 },
  },
  {
    label: "BookingEvent: subjectId+occurredAt+createdAt (cross-subject timeline lookup)",
    model: BookingEvent,
    spec: { subjectId: 1, occurredAt: 1, createdAt: 1 },
  },
  {
    label: "Review: moderationStatus+reportCount+createdAt (getFlaggedReviews, replaces 2-field)",
    model: Review,
    spec: { moderationStatus: 1, reportCount: -1, createdAt: -1 },
    replaces: { moderationStatus: 1, reportCount: -1 },
  },
  {
    label: "Expert: isActive+rating+createdAt (listActiveExperts, replaces 2-field)",
    model: Expert,
    spec: { isActive: 1, rating: -1, createdAt: -1 },
    replaces: { isActive: 1, rating: -1 },
  },
  {
    label: "FriendConnection: recipientId+status+updatedAt (getFriends)",
    model: FriendConnection,
    spec: { recipientId: 1, status: 1, updatedAt: -1 },
  },
  {
    label: "FriendConnection: requesterId+status+updatedAt (getFriends)",
    model: FriendConnection,
    spec: { requesterId: 1, status: 1, updatedAt: -1 },
  },
];

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 35: add second-pass client indexes (${apply ? "APPLY" : "DRY RUN"})...`
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
      if (target.replaces) {
        console.log(`  [would drop, once created] superseded index for ${target.label}`);
      }
      continue;
    }

    console.log(`  [creating] ${target.label}...`);
    const name = Object.entries(target.spec)
      .map(([k, d]) => `${k}_${d}`)
      .join("_");
    await collection.createIndex(target.spec, { name });

    if (target.replaces) {
      const stale = existing.find((index) => keysMatch(index.key || {}, target.replaces!));
      if (stale?.name) {
        console.log(`  [dropping superseded] ${stale.name}...`);
        await collection.dropIndex(stale.name);
      }
    }
  }

  console.log(apply ? "Migration 35 complete." : "Dry run complete — re-run with --apply.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Reverting migration 35 (${apply ? "APPLY" : "DRY RUN"}) — dropping these indexes...`
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

    if (target.replaces) {
      console.log(`  [recreating superseded index] for ${target.label}...`);
      const name = Object.entries(target.replaces)
        .map(([k, d]) => `${k}_${d}`)
        .join("_");
      await collection.createIndex(target.replaces, { name });
    }
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
      console.error("Migration 35 failed:", error);
      process.exit(1);
    });
}
