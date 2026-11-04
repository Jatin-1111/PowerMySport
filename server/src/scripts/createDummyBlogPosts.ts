import "dotenv/config";
import { connectDB } from "../config/database";
import { User } from "../client/models/User";
import { BlogService } from "../community/services/BlogService";

/**
 * Publishes sample blog posts as the dummy Parent accounts created by
 * createDummyParentAccounts.ts.
 * Usage: npx ts-node src/scripts/createDummyBlogPosts.ts
 */
const DUMMY_PARENT_EMAILS = [
  "dummy.parent1@powermysport.com",
  "dummy.parent2@powermysport.com",
  "dummy.parent3@powermysport.com",
  "dummy.parent4@powermysport.com",
  "dummy.parent5@powermysport.com",
];

const SAMPLE_BLOGS = [
  {
    title: "5 things I wish I knew before enrolling my son in a badminton academy",
    excerpt:
      "A few practical lessons from a year of academy pickups, kit shopping, and tournament weekends.",
    topic: "Coaching",
    tags: ["badminton", "academy", "parenting"],
    content:
      "<h2>Start with a trial month</h2><p>Most academies will let you sit in on a free or low-cost trial class before committing to a term. Use it to watch how the coach handles kids who are still figuring out the basics, not just the talented ones.</p><h2>Budget for more than the fee</h2><p>Between shoes, a proper racket, tournament entry fees, and travel, the academy fee itself was maybe half of what we spent in the first year.</p><h2>Let them set the pace</h2><p>We pushed too hard early on and it backfired. Once we let our son decide how many days a week he wanted to train, his enthusiasm actually went up.</p>",
  },
  {
    title: "How we set up a home practice corner for cricket on a small budget",
    excerpt:
      "You don't need a backyard net to keep a young cricketer's skills sharp between academy sessions.",
    topic: "Training",
    tags: ["cricket", "home-practice", "budget"],
    content:
      "<h2>A wall and a tennis ball go a long way</h2><p>We cleared a stretch of wall in the garage and marked a stump outline with tape. Ten minutes of throwdowns after school made a visible difference in her footwork within a month.</p><h2>Second-hand gear is fine at this stage</h2><p>We bought a used bat and pads through a local sports parents' group instead of new ones, since she was still growing out of sizes every few months.</p><h2>Keep it playful</h2><p>The moment practice felt like a chore, interest dropped. We now treat it as a game with small challenges rather than structured drills.</p>",
  },
  {
    title: "Balancing academics and swim training: what actually worked for us",
    excerpt:
      "Notes from a season of managing 5-day-a-week swim practice alongside board exam prep.",
    topic: "Academics",
    tags: ["swimming", "academics", "time-management"],
    content:
      "<h2>Fixed homework windows before practice</h2><p>We moved homework to right after school and before practice, when energy was still high, instead of trying to fit it in late at night.</p><h2>Talk to the coach about exam season</h2><p>Most coaches are more flexible than parents expect. Ours agreed to a lighter load during exam weeks without dropping our daughter from the squad.</p><h2>Sleep is non-negotiable</h2><p>Cutting sleep to fit in more revision backfired badly — recovery times and grades both suffered. We now protect bedtime over everything else.</p>",
  },
  {
    title: "What our physiotherapist taught us about youth sports injuries",
    excerpt:
      "Lessons from a minor ankle sprain that changed how we think about recovery and return-to-play.",
    topic: "Injury & Recovery",
    tags: ["injury", "recovery", "football"],
    content:
      "<h2>Rest doesn't mean total inactivity</h2><p>Our physio had our son doing gentle mobility work within days of the sprain, which he said sped up recovery compared to complete rest.</p><h2>Get a professional opinion before returning</h2><p>It's tempting to let a kid back on the field once swelling goes down, but a proper assessment caught residual weakness we wouldn't have noticed.</p><h2>Build a return-to-play plan</h2><p>Instead of jumping straight back into full training, we followed a staged plan over two weeks — light jogging, then drills, then full contact.</p>",
  },
  {
    title: "Feeding a young athlete during tournament season: our meal planning notes",
    excerpt:
      "How we adjusted meals and snacks for back-to-back tennis tournaments without relying on packaged energy bars.",
    topic: "Nutrition",
    tags: ["nutrition", "tournaments", "tennis"],
    content:
      "<h2>Simple carbs before matches</h2><p>We found that something light like a banana or toast an hour before a match worked better for our daughter than a heavy pre-match meal.</p><h2>Protein-focused recovery meals</h2><p>After a long match day, we shifted dinner to be protein-heavy with dal, eggs, or paneer to help with muscle recovery.</p><h2>Hydration reminders, not just water bottles</h2><p>Just carrying a water bottle wasn't enough — we started setting phone reminders during long tournament days to make sure she was actually drinking regularly.</p>",
  },
];

async function createDummyBlogPosts() {
  try {
    await connectDB();

    console.log("\nPublishing sample blog posts as dummy Parent accounts...\n");

    for (let i = 0; i < SAMPLE_BLOGS.length; i++) {
      const email = DUMMY_PARENT_EMAILS[i % DUMMY_PARENT_EMAILS.length]!;
      const blog = SAMPLE_BLOGS[i]!;

      const author = await User.findOne({ email });
      if (!author) {
        console.log(`- Skipped "${blog.title}" (author not found: ${email})`);
        continue;
      }

      const created = await BlogService.createBlog(String(author._id), {
        ...blog,
        status: "PUBLISHED",
      });

      console.log(`- Published as ${email}: "${created.title}" (id: ${created.id})`);
    }

    console.log("\nDone.\n");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createDummyBlogPosts();
