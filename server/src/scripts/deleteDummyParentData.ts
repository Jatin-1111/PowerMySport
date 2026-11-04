import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { User } from "../client/models/User";
import { CommunityPost } from "../community/models/CommunityPost";
import { CommunityAnswer } from "../community/models/CommunityAnswer";
import { CommunityProfile } from "../community/models/CommunityProfile";
import { Experience } from "../community/models/Experience";
import { cascadeDeleteUserData } from "../shared/services/AuthService/accountDeletion";

/**
 * Deletes the dummy Parent accounts, and everything that names them.
 *
 * It removes the accounts created by:
 *   - createDummyParentAccounts.ts
 *   - createDummyCommunityPosts.ts
 *   - createDummyCommunityAnswers.ts
 *   - createDummyBlogPosts.ts
 *
 * What goes with each account:
 *   - everything `cascadeDeleteUserData` removes, the same list real account
 *     deletion uses: children and what names them, guidance and assistant chats,
 *     check-ins, season plans, notifications, community reactions, and so on;
 *   - the community content the account authored (answers, posts, blog posts, its
 *     community profile), which real deletion keeps but a dummy account should not.
 *
 * This script used to delete the account and its community content and nothing
 * else, which left the children, guidance submissions, check-ins and chats of every
 * dummy parent behind with no owner. 10 of 16 children and 41 guidance submissions
 * in production were that.
 *
 * MONEY IS NEVER DELETED. A dummy user with a booking, a payment record, an order,
 * an expert session, a coach subscription or a wallet balance is SKIPPED, whole,
 * and reported. Deleting the account would leave that record pointing at nobody.
 *
 * It is a DRY RUN unless `--apply` is given, because it runs against the one
 * database, which is production. After an apply it reports any row that still
 * points at a deleted account, so a collection the cascade does not cover is
 * visible the first time it matters, not months later.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/scripts/deleteDummyParentData.ts
 *   npx ts-node src/scripts/deleteDummyParentData.ts --apply
 */
const DUMMY_PARENT_EMAILS = [
  "dummy.parent1@powermysport.com",
  "dummy.parent2@powermysport.com",
  "dummy.parent3@powermysport.com",
  "dummy.parent4@powermysport.com",
  "dummy.parent5@powermysport.com",
];

/** Records that outlive an account. A dummy user who has any is not deleted. */
const MONEY: Array<{ collection: string; field: string; extra?: object }> = [
  { collection: "bookings", field: "userId" },
  { collection: "bookingpaymenttransactions", field: "userId" },
  { collection: "orders", field: "userId" },
  { collection: "expertsessions", field: "userId" },
  { collection: "coachsubscriptions", field: "userId" },
  { collection: "coachsubscriptionpaymenttransactions", field: "userId" },
  { collection: "wallets", field: "userId", extra: { balance: { $ne: 0 } } },
];

/** Fields that name a user, scanned in every collection to find what is left behind. */
const USER_FIELDS = [
  "userId",
  "authorId",
  "parentId",
  "requesterId",
  "recipientId",
  "senderId",
  "ownerId",
  "createdBy",
];

const apply = process.argv.slice(2).includes("--apply");

/** Per `collection.field`, how many rows name any of these users. Only non-zero. */
export const referencesTo = async (
  ids: mongoose.Types.ObjectId[]
): Promise<Record<string, number>> => {
  const db = mongoose.connection.db!;
  const found: Record<string, number> = {};
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (name.startsWith("system.") || name === "users") continue;
    for (const field of USER_FIELDS) {
      const n = await db.collection(name).countDocuments({ [field]: { $in: ids } });
      if (n > 0) found[`${name}.${field}`] = n;
    }
  }
  return found;
};

/** Money records that name this user, so a user who has any can be skipped. */
export const moneyFor = async (id: mongoose.Types.ObjectId): Promise<Record<string, number>> => {
  const db = mongoose.connection.db!;
  const found: Record<string, number> = {};
  for (const { collection, field, extra } of MONEY) {
    const n = await db.collection(collection).countDocuments({ [field]: id, ...(extra ?? {}) });
    if (n > 0) found[collection] = n;
  }
  return found;
};

async function deleteDummyParentData() {
  try {
    await connectDB();

    const users = await User.find({ email: { $in: DUMMY_PARENT_EMAILS } });
    if (users.length === 0) {
      console.log("\nNo dummy parent accounts found. Nothing to delete.\n");
      process.exit(0);
    }

    console.log(`\nFound ${users.length} dummy parent account(s):`);
    const deletable: typeof users = [];
    for (const user of users) {
      const money = await moneyFor(user._id);
      if (Object.keys(money).length > 0) {
        console.log(`- ${user.email}  SKIPPED, has money records: ${JSON.stringify(money)}`);
      } else {
        console.log(`- ${user.email}`);
        deletable.push(user);
      }
    }
    if (deletable.length === 0) {
      console.log("\nNothing safe to delete.\n");
      process.exit(0);
    }

    const ids = deletable.map((user) => user._id);
    console.log("\nRows that name these accounts now:");
    console.log(JSON.stringify(await referencesTo(ids), null, 2));

    if (!apply) {
      console.log("\nDry run. Nothing was deleted. Re-run with --apply.\n");
      process.exit(0);
    }

    for (const user of deletable) {
      await cascadeDeleteUserData(user._id.toString());
    }

    // Authored community content: real deletion keeps it under an anonymised name, but
    // a dummy account's posts are not something to keep.
    const answers = await CommunityAnswer.deleteMany({ authorId: { $in: ids } });
    const posts = await CommunityPost.deleteMany({ authorId: { $in: ids } });
    const blogs = await Experience.deleteMany({ authorId: { $in: ids } });
    const profiles = await CommunityProfile.deleteMany({ userId: { $in: ids } });
    console.log(
      `\nDeleted ${answers.deletedCount} answer(s), ${posts.deletedCount} post(s), ` +
        `${blogs.deletedCount} blog post(s), ${profiles.deletedCount} community profile(s).`
    );

    const removed = await User.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${removed.deletedCount} user account(s).`);

    const left = await referencesTo(ids);
    if (Object.keys(left).length === 0) {
      console.log("\nNothing still names the deleted accounts. Done.\n");
    } else {
      console.log(
        "\nStill naming the deleted accounts (not covered by the cascade, look at each):"
      );
      console.log(JSON.stringify(left, null, 2));
      console.log("");
    }
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  void deleteDummyParentData();
}
