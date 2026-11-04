import "dotenv/config";
import { connectDB } from "../config/database";
import { User } from "../client/models/User";
import { CommunityPost } from "../community/models/CommunityPost";
import { answersService } from "../community/services/communityQnaService/answers";

/**
 * Posts sample answers to the dummy Q&A posts created by
 * createDummyCommunityPosts.ts, answered by the other dummy Parent accounts.
 * Usage: npx ts-node src/scripts/createDummyCommunityAnswers.ts
 */
const DUMMY_PARENT_EMAILS = [
  "dummy.parent1@powermysport.com",
  "dummy.parent2@powermysport.com",
  "dummy.parent3@powermysport.com",
  "dummy.parent4@powermysport.com",
  "dummy.parent5@powermysport.com",
];

const SAMPLE_ANSWERS: Record<string, string[]> = {
  "How do I find a good badminton coach for a 10-year-old beginner?": [
    "We started with a group class at a local academy before moving to a personal coach — it helped my son build interest without the pressure of one-on-one attention too early.",
    "Ask the academy if you can sit in on a session before enrolling. We did this and it made a big difference in choosing the right coach for our daughter's temperament.",
  ],
  "Best budget-friendly cricket kit for an 8-year-old?": [
    "We bought a second-hand kit through a parents' WhatsApp group at our academy — worked out well since kids outgrow gear so quickly at that age.",
  ],
  "Managing school + swimming practice schedule — any tips?": [
    "We shifted homework to right after school, before practice, when energy was still high. Made evenings much less stressful.",
    "Talking to the coach helped a lot — ours was flexible about reducing sessions during exam weeks without dropping our kid from the squad.",
  ],
  "Recovering from a minor ankle sprain — when is it safe to return to football?": [
    "We got a physio's opinion before returning to full training — they caught some residual weakness that wasn't obvious just from the swelling going down.",
  ],
  "Nutrition tips for a young athlete training twice a day during tournament season": [
    "Light carbs like a banana or toast an hour before a match worked much better for us than a heavy pre-match meal.",
    "We started setting hydration reminders on the phone during long tournament days — just carrying a water bottle wasn't enough on its own.",
  ],
};

async function createDummyCommunityAnswers() {
  try {
    await connectDB();

    console.log("\nPosting sample answers to dummy Q&A posts...\n");

    const users = await User.find({ email: { $in: DUMMY_PARENT_EMAILS } });
    const userByEmail = new Map(users.map((u) => [u.email, u]));

    for (const [title, answers] of Object.entries(SAMPLE_ANSWERS)) {
      const post = await CommunityPost.findOne({ title });
      if (!post) {
        console.log(`- Skipped post "${title}" (not found)`);
        continue;
      }

      const answererEmails = DUMMY_PARENT_EMAILS.filter(
        (email) => String(userByEmail.get(email)?._id) !== String(post.authorId)
      );

      for (let i = 0; i < answers.length; i++) {
        const email = answererEmails[i % answererEmails.length]!;
        const answerer = userByEmail.get(email);
        if (!answerer) continue;

        await answersService.createAnswer(String(answerer._id), String(post._id), answers[i]!);
        console.log(`- Answered "${title}" as ${email}`);
      }
    }

    console.log("\nDone.\n");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createDummyCommunityAnswers();
