import { User } from "../../client/models/User";
import { CommunityProfile } from "../models/CommunityProfile";
import { CommunityReputation } from "../models/CommunityReputation";
import { ensureProfile, resolveUserPhotoUrl } from "./communityShared";

/**
 * Reputation totals and the contributor leaderboard.
 *
 * Split out of CommunityService, which had grown to 4,400 lines. Composed back
 * into that object, so every existing `CommunityService.x()` call site is
 * unchanged.
 */
export const communityContributionService = {
  async getMyReputation(userId: string) {
    await ensureProfile(userId);

    const reputation = await CommunityReputation.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          totalPoints: 0,
          questionCount: 0,
          answerCount: 0,
          receivedUpvotes: 0,
        },
      },
      { upsert: true, new: true }
    ).lean();

    return {
      userId,
      totalPoints: reputation?.totalPoints || 0,
      questionCount: reputation?.questionCount || 0,
      answerCount: reputation?.answerCount || 0,
      receivedUpvotes: reputation?.receivedUpvotes || 0,
    };
  },

  /**
   * Ranked by the same `totalPoints` the page already shows as "Your Points".
   * The previous client-side leaderboard scored a different formula over the
   * most recent posts, so a user's rank had no relationship to their points —
   * and because `listPosts` caps `limit` at 50, it ranked 50 posts while
   * asking for 120.
   */
  async listLeaderboard(userId: string, limit = 15) {
    await ensureProfile(userId);

    const safeLimit = Math.min(50, Math.max(1, limit));

    const top = await CommunityReputation.find({ totalPoints: { $gt: 0 } })
      .sort({ totalPoints: -1, updatedAt: 1 })
      .limit(safeLimit)
      .lean();

    const [users, profiles] = await Promise.all([
      User.find({ _id: { $in: top.map((row) => row.userId) } })
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: top.map((row) => row.userId) } })
        .select("userId anonymousAlias isIdentityPublic")
        .lean(),
    ]);

    const userById = new Map(users.map((user) => [String(user._id), user]));
    const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]));

    const items = await Promise.all(
      top.map(async (row, index) => {
        const rowUserId = String(row.userId);
        const user = userById.get(rowUserId);
        const profile = profileByUserId.get(rowUserId);
        const isSelf = rowUserId === userId;
        // A member who keeps their identity private is ranked but not named —
        // reputation is public, the person behind it is theirs to reveal.
        const isPublic = profile?.isIdentityPublic ?? true;

        return {
          id: isPublic || isSelf ? rowUserId : "",
          name: isSelf
            ? user?.name || "Me"
            : isPublic
              ? user?.name || "Player"
              : profile?.anonymousAlias || "Anonymous Player",
          photoUrl: isPublic && user ? await resolveUserPhotoUrl(user) : null,
          isIdentityPublic: isPublic,
          rank: index + 1,
          posts: row.questionCount || 0,
          answers: row.answerCount || 0,
          upvotes: row.receivedUpvotes || 0,
          score: row.totalPoints || 0,
        };
      })
    );

    // The caller's own standing, resolved even when they sit outside the page
    // so the UI can pin a "you are #204" row rather than showing nothing.
    const mine = await CommunityReputation.findOne({ userId })
      .select("totalPoints questionCount answerCount receivedUpvotes")
      .lean();

    let me: (typeof items)[number] | null = null;
    if (mine && (mine.totalPoints || 0) > 0) {
      const ahead = await CommunityReputation.countDocuments({
        totalPoints: { $gt: mine.totalPoints },
      });
      const self =
        userById.get(userId) ||
        (await User.findById(userId).select("_id name photoUrl photoS3Key").lean());
      me = {
        id: userId,
        name: self?.name || "Me",
        photoUrl: self ? await resolveUserPhotoUrl(self) : null,
        isIdentityPublic: true,
        rank: ahead + 1,
        posts: mine.questionCount || 0,
        answers: mine.answerCount || 0,
        upvotes: mine.receivedUpvotes || 0,
        score: mine.totalPoints || 0,
      };
    }

    return { items, me };
  },
};
