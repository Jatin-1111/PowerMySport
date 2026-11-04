import "dotenv/config";
import mongoose from "mongoose";
import FriendConnection from "../client/models/FriendConnection";
import { User } from "../client/models/User";

/**
 * Migration 40: delete FriendConnection rows whose requester or recipient no
 * longer exists.
 *
 * Account deletion clears a user's connections, so these are rows left behind
 * by some path that removed a user without that cleanup. They are pure garbage:
 * a friendship needs two people, and one of them is gone.
 *
 * The visible symptom was the dashboard reporting "2 connections." directly
 * above "No connections yet" — a count over every row sitting above a list that
 * dropped the dead ones. That read now filters, so this is no longer what makes
 * the friends list correct.
 *
 * It still matters for the counts that *cannot* cheaply filter.
 * `countPendingRequests` is a bare `countDocuments` on
 * `{ recipientId, status: "PENDING" }`, and it feeds the nav badge on every
 * dashboard load. A pending request from a deleted account shows there as a
 * friend request that does not exist and cannot be actioned. Filtering that
 * endpoint would mean a user lookup on a hot badge query to defend against data
 * that should not exist; deleting the garbage fixes it for free. Hence: filter
 * where filtering is free, clean the data where it is not.
 *
 * Covers every status, not just ACCEPTED — a dangling PENDING row is the one
 * that produces the phantom badge, and DECLINED/BLOCKED rows referencing a
 * deleted user are equally meaningless.
 *
 * Idempotent: a second run finds nothing.
 *
 * NOT REVERSIBLE. `down` cannot recreate rows whose users no longer exist, and
 * restoring them would only recreate the bug. It reports and exits.
 *
 * USAGE
 *   npm run migrate:dangling-friends                 # dry run (default)
 *   npm run migrate:dangling-friends -- --apply      # delete them
 */

interface Options {
  apply?: boolean;
}

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 40: delete dangling friend connections (${apply ? "APPLY" : "DRY RUN"})...`
  );

  const connections = await FriendConnection.find({})
    .select("requesterId recipientId status")
    .lean();

  console.log(`  scanned ${connections.length} connection(s).`);

  if (connections.length === 0) {
    console.log("  no connections at all — nothing to do.");
    return;
  }

  const referenced = new Set<string>();
  for (const conn of connections) {
    referenced.add(String(conn.requesterId));
    referenced.add(String(conn.recipientId));
  }

  const survivors = await User.find({ _id: { $in: [...referenced] } })
    .select("_id")
    .lean();
  const alive = new Set(survivors.map((user) => String(user._id)));

  console.log(`  ${referenced.size} distinct user(s) referenced, ${alive.size} still exist.`);

  const dangling = connections.filter(
    (conn) => !alive.has(String(conn.requesterId)) || !alive.has(String(conn.recipientId))
  );

  if (dangling.length === 0) {
    console.log("  no dangling connections — nothing to do.");
    return;
  }

  const byStatus = dangling.reduce<Record<string, number>>((acc, conn) => {
    const status = String(conn.status || "UNKNOWN");
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  console.log(`  found ${dangling.length} dangling connection(s):`);
  for (const [status, count] of Object.entries(byStatus).sort()) {
    const note = status === "PENDING" ? "  <- these show as phantom friend requests" : "";
    console.log(`    ${status}: ${count}${note}`);
  }

  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }

  const result = await FriendConnection.deleteMany({
    _id: { $in: dangling.map((conn) => conn._id) },
  });

  console.log(`  deleted ${result.deletedCount} connection(s).`);
  console.log("Migration 40 complete.");
};

export const down = async () => {
  console.log("Migration 40 is not reversible.");
  console.log(
    "  The deleted rows referenced users that no longer exist, so there is nothing\n" +
      "  to restore them to — and restoring them would only recreate the bug."
  );
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
    .then(() => (isDown ? down() : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 40 failed:", error);
      process.exit(1);
    });
}
