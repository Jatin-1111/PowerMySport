import "dotenv/config";
import { connectDB } from "../config/database";
import { User } from "../client/models/User";
import { CommunityPost } from "../community/models/CommunityPost";
import { CommunityAnswer } from "../community/models/CommunityAnswer";
import { CommunityProfile } from "../community/models/CommunityProfile";
import { CommunityReputation } from "../community/models/CommunityReputation";
import { BlogPost } from "../community/models/BlogPost";

/**
 * Deletes the dummy Parent accounts (and everything they authored: Q&A posts,
 * answers, blog posts, community profiles, reputation) created by:
 *   - createDummyParentAccounts.ts
 *   - createDummyCommunityPosts.ts
 *   - createDummyCommunityAnswers.ts
 *   - createDummyBlogPosts.ts
 *
 * Usage: npx ts-node src/scripts/deleteDummyParentData.ts
 */
const DUMMY_PARENT_EMAILS = [
  "dummy.parent1@powermysport.com",
  "dummy.parent2@powermysport.com",
  "dummy.parent3@powermysport.com",
  "dummy.parent4@powermysport.com",
  "dummy.parent5@powermysport.com",
];

async function deleteDummyParentData() {
  try {
    await connectDB();

    const users = await User.find({ email: { $in: DUMMY_PARENT_EMAILS } });
    if (users.length === 0) {
      console.log("\nNo dummy parent accounts found. Nothing to delete.\n");
      process.exit(0);
    }

    const userIds = users.map((u) => u._id);
    console.log(`\nFound ${users.length} dummy parent account(s):`);
    users.forEach((u) => console.log(`- ${u.email} (${u._id})`));
    console.log("");

    const answers = await CommunityAnswer.deleteMany({ authorId: { $in: userIds } });
    console.log(`- Deleted ${answers.deletedCount} community answer(s)`);

    const posts = await CommunityPost.deleteMany({ authorId: { $in: userIds } });
    console.log(`- Deleted ${posts.deletedCount} community post(s)`);

    const blogs = await BlogPost.deleteMany({ authorId: { $in: userIds } });
    console.log(`- Deleted ${blogs.deletedCount} blog post(s)`);

    const profiles = await CommunityProfile.deleteMany({ userId: { $in: userIds } });
    console.log(`- Deleted ${profiles.deletedCount} community profile(s)`);

    const reputations = await CommunityReputation.deleteMany({ userId: { $in: userIds } });
    console.log(`- Deleted ${reputations.deletedCount} reputation record(s)`);

    const deletedUsers = await User.deleteMany({ _id: { $in: userIds } });
    console.log(`- Deleted ${deletedUsers.deletedCount} user account(s)`);

    console.log("\nDone.\n");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

deleteDummyParentData();
