import "dotenv/config";
import mongoose from "mongoose";
import { CommunityGroup } from "../community/models/CommunityGroup";
import { CommunityGroupMember } from "../community/models/CommunityGroupMember";

/**
 * Migration 26: move group membership out of the group document.
 *
 * `CommunityGroup` carried `members: ObjectId[]` and `admins: ObjectId[]`
 * embedded. That capped a group at what fits in one 16MB BSON document, turned
 * every join into a read-modify-write of the whole array (so two people joining
 * at once could clobber each other), and made "which groups am I in" a scan.
 * Membership is now one `CommunityGroupMember` row per person, and the group
 * keeps only a denormalized `memberCount`.
 *
 * ── What this writes ─────────────────────────────────────────────────────────
 *  1. One CommunityGroupMember row per entry in each group's `members` array,
 *     with role ADMIN for anyone also in `admins`.
 *  2. `memberCount` on each group.
 *  3. With --apply --drop-arrays, unsets the old `members`/`admins` fields.
 *
 * ── Order is load-bearing ────────────────────────────────────────────────────
 * Steps 1-2 are additive and safe to run against a live deployment BEFORE the
 * new code ships: old code keeps reading the arrays, new rows sit unused
 * alongside. Step 3 is destructive and must run AFTER the new code is live,
 * because it removes the only thing the old code can read. Run them as two
 * separate invocations, not one.
 *
 * Idempotent: memberships upsert on (groupId, userId), and memberCount is
 * recomputed from the rows rather than incremented, so re-running converges
 * instead of doubling.
 *
 * ── Recovering a bad run ─────────────────────────────────────────────────────
 * `--down --apply` rebuilds `members`/`admins` from the rows and deletes them.
 * That is a true inverse ONLY while the arrays have not been dropped, or while
 * the rows still exist — once both have happened in sequence there is no local
 * copy left and the restore is from a database backup. Take one before
 * --drop-arrays.
 *
 * USAGE
 *   npm run migrate:group-members                            # dry run
 *   npm run migrate:group-members -- --apply                 # write rows + counts
 *   npm run migrate:group-members -- --apply --drop-arrays   # AFTER code is live
 *   npm run migrate:group-members -- --down --apply          # rebuild arrays
 */

interface Options {
  apply?: boolean;
  dropArrays?: boolean;
}

interface LegacyGroup {
  _id: mongoose.Types.ObjectId;
  name?: string;
  members?: mongoose.Types.ObjectId[];
  admins?: mongoose.Types.ObjectId[];
}

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  const dropArrays = Boolean(options.dropArrays);

  console.log(
    `Starting migration 26: extract group members (${apply ? "APPLY" : "DRY RUN"}${
      dropArrays ? ", DROP ARRAYS" : ""
    })...`,
  );

  // Read through the raw collection: the Mongoose schema no longer declares
  // `members`/`admins`, so a modelled query would strip the very fields this
  // migration exists to read.
  const collection = CommunityGroup.collection;
  const groups = (await collection
    .find({}, { projection: { _id: 1, name: 1, members: 1, admins: 1 } })
    .toArray()) as unknown as LegacyGroup[];

  let groupsSeen = 0;
  let membershipsPlanned = 0;
  let adminsPlanned = 0;
  let orphanGroups = 0;

  for (const group of groups) {
    groupsSeen += 1;

    const memberIds = (group.members || []).map((id) => String(id));
    const adminIds = new Set((group.admins || []).map((id) => String(id)));

    // An admin missing from `members` is inconsistent legacy data; treat them
    // as a member too rather than silently dropping their membership.
    for (const adminId of adminIds) {
      if (!memberIds.includes(adminId)) {
        memberIds.push(adminId);
      }
    }

    const unique = [...new Set(memberIds)];
    if (unique.length === 0) {
      orphanGroups += 1;
    }

    membershipsPlanned += unique.length;
    adminsPlanned += unique.filter((id) => adminIds.has(id)).length;

    if (!apply) {
      continue;
    }

    if (unique.length > 0) {
      await CommunityGroupMember.bulkWrite(
        unique.map((memberId) => ({
          updateOne: {
            filter: { groupId: group._id, userId: memberId },
            update: {
              $setOnInsert: {
                groupId: group._id,
                userId: new mongoose.Types.ObjectId(memberId),
              },
              // Role is $set, not $setOnInsert: a re-run must correct a role
              // that changed in the source arrays since the last pass.
              $set: { role: adminIds.has(memberId) ? "ADMIN" : "MEMBER" },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    // Recomputed, never incremented, so a second pass converges.
    const count = await CommunityGroupMember.countDocuments({
      groupId: group._id,
    });
    await collection.updateOne(
      { _id: group._id },
      { $set: { memberCount: count } },
    );
  }

  console.log(`  groups scanned:        ${groupsSeen}`);
  console.log(`  memberships ${apply ? "written" : "to write"}: ${membershipsPlanned}`);
  console.log(`  of which admins:       ${adminsPlanned}`);
  if (orphanGroups > 0) {
    console.log(
      `  groups with no members: ${orphanGroups} (left in place, memberCount 0)`,
    );
  }

  if (dropArrays) {
    if (!apply) {
      console.log("  would unset members/admins on every group");
    } else {
      const result = await collection.updateMany(
        {},
        { $unset: { members: "", admins: "" } },
      );
      console.log(`  arrays unset on ${result.modifiedCount} groups`);
    }
  }

  console.log(
    apply ? "Migration 26 complete." : "Dry run complete — re-run with --apply.",
  );
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Reverting migration 26 (${apply ? "APPLY" : "DRY RUN"})— rebuilding embedded arrays...`,
  );

  const collection = CommunityGroup.collection;
  const groupIds = await CommunityGroupMember.distinct("groupId");

  for (const groupId of groupIds) {
    const rows = await CommunityGroupMember.find({ groupId })
      .select("userId role")
      .sort({ createdAt: 1 })
      .lean();

    if (!apply) {
      continue;
    }

    await collection.updateOne(
      { _id: groupId },
      {
        $set: {
          members: rows.map((row) => row.userId),
          admins: rows
            .filter((row) => row.role === "ADMIN")
            .map((row) => row.userId),
        },
        $unset: { memberCount: "" },
      },
    );
  }

  if (apply) {
    await CommunityGroupMember.deleteMany({});
  }

  console.log(`  groups restored: ${groupIds.length}`);
  console.log(apply ? "Revert complete." : "Dry run complete.");
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const options: Options = {
    apply: argv.includes("--apply"),
    dropArrays: argv.includes("--drop-arrays"),
  };
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
      console.error("Migration 26 failed:", error);
      process.exit(1);
    });
}
