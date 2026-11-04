import "dotenv/config";
import { connectDB } from "../config/database";
import { User } from "../client/models/User";
import { postsService } from "../community/services/communityQnaService/posts";

/**
 * Posts sample Q&A content as the dummy Parent accounts created by
 * createDummyParentAccounts.ts.
 * Usage: npx ts-node src/scripts/createDummyCommunityPosts.ts
 */
const DUMMY_PARENT_EMAILS = [
  "dummy.parent1@powermysport.com",
  "dummy.parent2@powermysport.com",
  "dummy.parent3@powermysport.com",
  "dummy.parent4@powermysport.com",
  "dummy.parent5@powermysport.com",
];

const SAMPLE_POSTS = [
  {
    title: "How do I find a good badminton coach for a 10-year-old beginner?",
    body: "My son just started showing interest in badminton after watching a few tournaments on TV. He's 10 and has never played competitively. What should I look for in a coach at this stage — someone focused on fundamentals, or should we just start with a local academy group class? Would love to hear from parents who've been through this.",
    category: "Coaching",
    sport: "Badminton",
    tags: ["beginner", "coaching", "kids"],
  },
  {
    title: "Best budget-friendly cricket kit for an 8-year-old?",
    body: "Looking for recommendations on a starter cricket kit (bat, pads, gloves) for my daughter who just joined a weekend academy. Don't want to overspend since she's still figuring out if she'll stick with it, but also don't want something that falls apart in a month. Any brands that hit a good middle ground?",
    category: "Equipment",
    sport: "Cricket",
    tags: ["equipment", "budget", "cricket"],
  },
  {
    title: "Managing school + swimming practice schedule — any tips?",
    body: "My kid trains 5 days a week for swimming and it's getting tough to balance with homework and school timings. Anyone else dealing with a similar schedule? Curious how other parents structure the evenings so both academics and training get proper attention without burning the kid out.",
    category: "Training",
    sport: "Swimming",
    tags: ["schedule", "balance", "swimming"],
  },
  {
    title: "Recovering from a minor ankle sprain — when is it safe to return to football?",
    body: "My son sprained his ankle mildly during a school football match about 10 days ago. Swelling is mostly gone and he's walking normally, but he's eager to get back on the field. What's a reasonable timeline before returning to full training, and are there specific signs we should watch for before clearing him?",
    category: "Injury & Recovery",
    sport: "Football",
    tags: ["injury", "recovery", "football"],
  },
  {
    title: "Nutrition tips for a young athlete training twice a day during tournament season",
    body: "My daughter has back-to-back tennis tournaments coming up and is training twice daily. She's 13 and I want to make sure she's eating enough to recover but not overdoing processed energy snacks. What has worked for other parents in terms of meal timing and snacks between sessions?",
    category: "Nutrition",
    sport: "Tennis",
    tags: ["nutrition", "tournaments", "tennis"],
  },
];

async function createDummyCommunityPosts() {
  try {
    await connectDB();

    console.log("\nPosting sample community content as dummy Parent accounts...\n");

    for (let i = 0; i < SAMPLE_POSTS.length; i++) {
      const email = DUMMY_PARENT_EMAILS[i % DUMMY_PARENT_EMAILS.length]!;
      const post = SAMPLE_POSTS[i]!;

      const author = await User.findOne({ email });
      if (!author) {
        console.log(`- Skipped "${post.title}" (author not found: ${email})`);
        continue;
      }

      const created = await postsService.createPost(String(author._id), post);
      console.log(`- Posted as ${email}: "${created.title}" (id: ${created.id})`);
    }

    console.log("\nDone.\n");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createDummyCommunityPosts();
