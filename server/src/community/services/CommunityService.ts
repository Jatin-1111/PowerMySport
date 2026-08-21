import mongoose from "mongoose";
import {
  CommunityConversation,
  CommunityConversationDocument,
} from "../models/CommunityConversation";
import {
  CommunityGroup,
  type CommunityGroupVisibility,
} from "../models/CommunityGroup";
import { CommunityMessage } from "../models/CommunityMessage";
import {
  CommunityMessagePrivacy,
  CommunityProfile,
} from "../models/CommunityProfile";
import { User } from "../../client/models/User";
import { CommunityReport } from "../models/CommunityReport";
import { CommunityPost } from "../models/CommunityPost";
import { CommunityAnswer } from "../models/CommunityAnswer";
import { CommunityAnswerComment } from "../models/CommunityAnswerComment";
import { BlogPost } from "../models/BlogPost";
import { CommunityVote } from "../models/CommunityVote";
import { CommunityReputation } from "../models/CommunityReputation";
import {
  CommunityFollow,
  type CommunityFollowKind,
} from "../models/CommunityFollow";
import { NotificationService } from "../../client/services/NotificationService";
import OutboxMessage from "../../shared/models/OutboxMessage";
import { S3Service } from "../../shared/services/S3Service";
import {
  canJoinGroupAudience,
  COMMUNITY_INTERACTION_POLICY,
  isCrossRoleInteraction,
  ROLE_LABEL,
  type CommunityGroupAudience,
  type CommunityRole,
} from "./communityPolicy";
import { getVoteTransitionDeltas, normalizeTags } from "./communityQnaUtils";
import { resolveCommunityCredentials } from "./communityCredentials";
import {
  addMember,
  countMembers,
  getMemberRole,
  ensureGroupHasAdmin,
  isGroupAdmin,
  isGroupMember,
  listAdminIds,
  listMemberIds,
  membershipMapFor,
  removeAllMembers,
  removeMember,
} from "./communityGroupMembership";
import { CommunityGroupMember } from "../models/CommunityGroupMember";

const buildParticipantKey = (a: string, b: string): string =>
  [a, b].sort().join(":");

const buildGroupParticipantKey = (groupId: string): string =>
  `group:${groupId}`;

const normalizeOptionalText = (value?: string): string => value?.trim() || "";

/** Blog bodies are Tiptap HTML; a search snippet must not render markup or
 *  leak tag names into the preview text. */
const stripHtml = (value: string): string =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const clampForSnippet = (value: string, max = 180): string => {
  const text = stripHtml(value || "");
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}...`;
};

const MAX_FOLLOWS_PER_USER = 200;

/** Topics are free text and must match the tag normalization used when a post
 *  is saved, or `#Tennis` and `#tennis` become two different follows. Groups
 *  are ObjectIds and are validated as such so a junk id cannot be stored. */
const normalizeFollowTargetId = (
  kind: CommunityFollowKind,
  rawTargetId: string,
): string => {
  const value = String(rawTargetId || "").trim();

  if (kind === "GROUP") {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error("Invalid group id");
    }
    return value;
  }

  const topic = value.toLowerCase();
  if (!topic || topic.length > 40) {
    throw new Error("Invalid topic");
  }
  return topic;
};

// Supports multi-select filters sent as a comma-separated list (e.g. "Tennis,Cricket").
const splitCsvValues = (value?: string): string[] => {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MESSAGE_EDIT_DELETE_WINDOW_MS = 30 * 60 * 1000;
const COMMUNITY_ALLOWED_ROLES = ["Player", "Coach", "Parent"] as const;
const COMMUNITY_DEFAULT_GROUP_AUDIENCE = "ALL" as const;
const COMMUNITY_POINTS = {
  CREATE_POST: 5,
  CREATE_ANSWER: 8,
  RECEIVE_UPVOTE: 2,
  ANSWER_ACCEPTED: 15,
} as const;

const s3Service = new S3Service();

const resolveUserPhotoUrl = async (user?: {
  photoUrl?: string | null;
  photoS3Key?: string | null;
}): Promise<string | null> => {
  if (!user) {
    return null;
  }

  if (!user.photoS3Key) {
    return user.photoUrl || null;
  }

  try {
    return await s3Service.generateDownloadUrl(
      user.photoS3Key,
      "images",
      604800,
    );
  } catch (error) {
    console.error("Failed to refresh community photo URL:", error);
    return user.photoUrl || null;
  }
};

const resolveGroupPhotoUrl = async (group: {
  profilePicture?: string | null;
  profilePictureKey?: string | null;
}): Promise<string> => {
  if (!group.profilePictureKey) {
    return group.profilePicture || "";
  }

  try {
    return await s3Service.generateDownloadUrl(
      group.profilePictureKey,
      "images",
      604800,
    );
  } catch (error) {
    console.error("Failed to refresh community group photo URL:", error);
    return group.profilePicture || "";
  }
};

const calculateAge = (dob?: Date | string | null): number | null => {
  if (!dob) {
    return null;
  }

  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const ageDate = new Date(Date.now() - birthDate.getTime());
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const makeDefaultAlias = (name?: string): string => {
  const seed = Math.floor(1000 + Math.random() * 9000);
  const safeName = name?.trim().split(" ")[0] || "Member";
  return `${safeName}-${seed}`;
};

const generateInviteCode = (): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const getCommunityRole = async (userId: string): Promise<CommunityRole> => {
  const user = await ensureCommunityUser(userId);
  return user.role as CommunityRole;
};

const ensurePolicyAllowed = (policyEnabled: boolean, message: string): void => {
  if (!policyEnabled) {
    throw new Error(message);
  }
};

const trackCommunityRoleMixEvent = (
  event: string,
  payload: Record<string, unknown>,
) => {
  // Phase-3 telemetry hook: swap with analytics sink when available.
  console.info("[community-role-mix]", event, payload);
};

/** Accepted-answer points, applied in both directions so un-accepting and
 *  re-accepting cannot be farmed. Floors at zero — a historical accept that
 *  predates this counter must not push someone negative. */
const adjustAcceptedAnswerReputation = async (
  userId: string,
  direction: 1 | -1,
): Promise<void> => {
  const delta = direction * COMMUNITY_POINTS.ANSWER_ACCEPTED;

  if (delta < 0) {
    const current = await CommunityReputation.findOne({ userId })
      .select("totalPoints")
      .lean();
    const safeDelta = Math.max(delta, -(current?.totalPoints || 0));
    if (safeDelta === 0) {
      return;
    }
    await CommunityReputation.updateOne(
      { userId },
      { $inc: { totalPoints: safeDelta } },
    );
    return;
  }

  await CommunityReputation.updateOne(
    { userId },
    {
      $setOnInsert: { questionCount: 0, answerCount: 0, receivedUpvotes: 0 },
      $inc: { totalPoints: delta },
    },
    { upsert: true },
  );
};

const sendCommunityNotification = (
  userId: string,
  title: string,
  message: string,
  data: Record<string, unknown>,
) => {
  NotificationService.send({
    userId,
    type: "MESSAGE_RECEIVED",
    title,
    message,
    data,
  }).catch((error: unknown) => {
    console.error("Failed to send community notification:", error);
  });
};

const ensureQnaAllowedForRole = (role: CommunityRole): void => {
  ensurePolicyAllowed(
    COMMUNITY_INTERACTION_POLICY.allowCrossRoleQna,
    `Q&A participation is currently disabled for ${ROLE_LABEL[role]} accounts`,
  );
};

const ensureCommunityUser = async (userId: string) => {
  const user = await User.findById(userId).select("_id role name").lean();
  if (!user) {
    throw new Error("User not found");
  }

  if (
    !COMMUNITY_ALLOWED_ROLES.includes(
      user.role as (typeof COMMUNITY_ALLOWED_ROLES)[number],
    )
  ) {
    throw new Error(
      "Community is available only for player, coach, and parent accounts",
    );
  }

  return user;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean((error as { code?: number })?.code === 11000);

const ensureProfile = async (userId: string) => {
  const user = await ensureCommunityUser(userId);

  try {
    const profile = await CommunityProfile.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          anonymousAlias: makeDefaultAlias(user.name),
        },
      },
      { upsert: true, new: true },
    );

    if (!profile) {
      throw new Error("Failed to initialize community profile");
    }

    return profile;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existingProfile = await CommunityProfile.findOne({ userId });
    if (existingProfile) {
      return existingProfile;
    }

    throw new Error("Failed to initialize community profile");
  }
};

/**
 * Public read endpoints run behind optionalAuthMiddleware, which only verifies
 * the JWT signature — it never checks that the user still exists or that their
 * role can use the community. A stale token (deleted account, token minted
 * against another database) or a non-community role (Admin, VenueLister,
 * Expert…) would otherwise make ensureProfile throw and blank out a page that
 * is meant to render for guests. Downgrade those viewers to guest instead.
 */
const resolvePublicViewerId = async (
  userId: string | undefined,
): Promise<string | undefined> => {
  if (!userId) {
    return undefined;
  }

  try {
    await ensureProfile(userId);
    return userId;
  } catch {
    return undefined;
  }
};

const isBlockedBetween = async (
  userA: string,
  userB: string,
): Promise<boolean> => {
  const [a, b] = await Promise.all([
    CommunityProfile.findOne({ userId: userA }).select("blockedUsers"),
    CommunityProfile.findOne({ userId: userB }).select("blockedUsers"),
  ]);

  const aBlockedB = Boolean(
    a?.blockedUsers?.some((blocked) => String(blocked) === userB),
  );
  const bBlockedA = Boolean(
    b?.blockedUsers?.some((blocked) => String(blocked) === userA),
  );

  return aBlockedB || bBlockedA;
};

const formatParticipant = (
  selfId: string,
  participant: {
    _id: mongoose.Types.ObjectId;
    name: string;
    photoUrl?: string;
    profile?: {
      anonymousAlias: string;
      isIdentityPublic: boolean;
      lastSeenVisible: boolean;
      lastSeenAt?: Date;
    };
  },
) => {
  const profile = participant.profile;
  const isSelf = String(participant._id) === selfId;

  return {
    id: String(participant._id),
    displayName: isSelf
      ? participant.name
      : profile?.isIdentityPublic
        ? participant.name
        : profile?.anonymousAlias || "Anonymous Member",
    isIdentityPublic: profile?.isIdentityPublic ?? true,
    photoUrl:
      !isSelf && profile?.isIdentityPublic ? participant.photoUrl : null,
    lastSeenAt: profile?.lastSeenVisible ? profile?.lastSeenAt || null : null,
  };
};

export const CommunityService = {
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
      { upsert: true, new: true },
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
    const profileByUserId = new Map(
      profiles.map((profile) => [String(profile.userId), profile]),
    );

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
          photoUrl:
            isPublic && user ? await resolveUserPhotoUrl(user) : null,
          isIdentityPublic: isPublic,
          rank: index + 1,
          posts: row.questionCount || 0,
          answers: row.answerCount || 0,
          upvotes: row.receivedUpvotes || 0,
          score: row.totalPoints || 0,
        };
      }),
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

  /**
   * One search across questions and stories.
   *
   * Both collections carry a text index, so this is `$text` with a relevance
   * score rather than a regex scan — the two are not interchangeable: text
   * search matches whole stemmed words ("coaching" finds "coach"), while a
   * regex matches substrings but reads every document.
   *
   * Scores from two separate text indexes are not on a comparable scale, so
   * they are normalized per collection before merging. Without that the side
   * with longer documents wins every time regardless of relevance.
   */
  async searchCommunity(
    userId: string | undefined,
    query: string,
    options?: { type?: "ALL" | "POST" | "BLOG"; limit?: number },
  ) {
    const term = (query || "").trim();
    if (term.length < 2) {
      return { items: [], query: term };
    }

    const type = options?.type || "ALL";
    const safeLimit = Math.min(50, Math.max(1, options?.limit || 20));
    // Over-fetch each side so the merge has something to choose between; the
    // combined list is trimmed back to safeLimit at the end.
    const perSide = safeLimit;

    const wantPosts = type === "ALL" || type === "POST";
    const wantBlogs = type === "ALL" || type === "BLOG";

    const [posts, blogs] = await Promise.all([
      wantPosts
        ? CommunityPost.find(
            {
              $text: { $search: term },
              isDeleted: false,
              status: { $in: ["OPEN", "CLOSED"] },
            },
            { score: { $meta: "textScore" } },
          )
            .sort({ score: { $meta: "textScore" } })
            .limit(perSide)
            .lean()
        : Promise.resolve([]),
      wantBlogs
        ? BlogPost.find(
            {
              $text: { $search: term },
              isDeleted: false,
              status: "PUBLISHED",
            },
            { score: { $meta: "textScore" } },
          )
            .sort({ score: { $meta: "textScore" } })
            .limit(perSide)
            .lean()
        : Promise.resolve([]),
    ]);

    // Lean() results do not carry the projected `score` in their type, so it is
    // read through a narrow cast rather than widening the row types.
    const scoreOf = (row: unknown): number =>
      (row as { score?: number })?.score || 0;

    const normalize = <T>(rows: T[]): { row: T; relevance: number }[] => {
      const top = scoreOf(rows[0]);
      return rows.map((row) => ({
        row,
        relevance: top > 0 ? scoreOf(row) / top : 0,
      }));
    };

    const postItems = normalize(posts).map(({ row, relevance }) => ({
      kind: "POST" as const,
      id: String(row._id),
      title: row.title,
      snippet: clampForSnippet(row.body),
      href: `/questions/${String(row._id)}`,
      sport: row.sport || "",
      tags: row.tags || [],
      answerCount: row.answerCount || 0,
      isSolved: Boolean(row.acceptedAnswerId),
      createdAt: row.createdAt,
      relevance,
    }));

    const blogItems = normalize(blogs).map(({ row, relevance }) => ({
      kind: "BLOG" as const,
      id: String(row._id),
      title: row.title,
      snippet: clampForSnippet(row.excerpt || stripHtml(row.content || "")),
      href: `/blog/${String(row._id)}`,
      sport: "",
      tags: row.tags || [],
      answerCount: 0,
      isSolved: false,
      createdAt: row.createdAt,
      relevance,
    }));

    const items = [...postItems, ...blogItems]
      .sort((a, b) => {
        if (b.relevance !== a.relevance) {
          return b.relevance - a.relevance;
        }
        // Equally relevant: the fresher one first.
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
      .slice(0, safeLimit);

    return { items, query: term };
  },

  // ─── Follows ────────────────────────────────────────────────────────────────
  // Replaces a localStorage-only store, so these are deliberately forgiving:
  // the same follow arriving twice is a no-op rather than an error, and a
  // follow whose group has since been deleted is cleaned up on read instead of
  // being surfaced as a broken row.

  async listFollows(userId: string) {
    const follows = await CommunityFollow.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const groupIds = follows
      .filter((follow) => follow.kind === "GROUP")
      .map((follow) => follow.targetId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const groups = groupIds.length
      ? await CommunityGroup.find({ _id: { $in: groupIds } })
          .select("_id name")
          .lean()
      : [];

    const groupNameById = new Map(
      groups.map((group) => [String(group._id), group.name]),
    );

    const items: {
      kind: CommunityFollowKind;
      targetId: string;
      label: string;
      href: string;
      createdAt: string;
    }[] = [];
    const staleIds: mongoose.Types.ObjectId[] = [];

    for (const follow of follows) {
      if (follow.kind === "TOPIC") {
        items.push({
          kind: "TOPIC",
          targetId: follow.targetId,
          label: `#${follow.targetId}`,
          href: `/questions?tag=${encodeURIComponent(follow.targetId)}`,
          createdAt: follow.createdAt.toISOString(),
        });
        continue;
      }

      const name = groupNameById.get(follow.targetId);
      if (!name) {
        // The group was deleted out from under the follow. Drop the row rather
        // than render a tile that goes nowhere.
        staleIds.push(follow._id as mongoose.Types.ObjectId);
        continue;
      }

      items.push({
        kind: "GROUP",
        targetId: follow.targetId,
        label: name,
        href: "/discover?tab=COMMUNITIES",
        createdAt: follow.createdAt.toISOString(),
      });
    }

    if (staleIds.length) {
      void CommunityFollow.deleteMany({ _id: { $in: staleIds } }).catch(
        (error: unknown) => {
          console.error("Failed to prune stale community follows:", error);
        },
      );
    }

    return { items };
  },

  async toggleFollow(
    userId: string,
    payload: { kind: CommunityFollowKind; targetId: string },
  ): Promise<{ following: boolean }> {
    await ensureProfile(userId);

    const targetId = normalizeFollowTargetId(payload.kind, payload.targetId);

    const existing = await CommunityFollow.findOneAndDelete({
      userId,
      kind: payload.kind,
      targetId,
    });

    if (existing) {
      return { following: false };
    }

    const total = await CommunityFollow.countDocuments({ userId });
    if (total >= MAX_FOLLOWS_PER_USER) {
      throw new Error(
        `You can follow at most ${MAX_FOLLOWS_PER_USER} groups and topics`,
      );
    }

    await CommunityFollow.updateOne(
      { userId, kind: payload.kind, targetId },
      { $setOnInsert: { userId, kind: payload.kind, targetId } },
      { upsert: true },
    );

    return { following: true };
  },

  /**
   * One-shot import of the follows a user accumulated in localStorage before
   * follows were persisted. Idempotent, so a client that retries — or a user
   * with two browsers — merges rather than duplicates.
   */
  async importFollows(
    userId: string,
    items: { kind: CommunityFollowKind; targetId: string }[],
  ): Promise<{ imported: number }> {
    await ensureProfile(userId);

    const existingCount = await CommunityFollow.countDocuments({ userId });
    const room = Math.max(0, MAX_FOLLOWS_PER_USER - existingCount);
    if (room === 0) {
      return { imported: 0 };
    }

    const seen = new Set<string>();
    const operations: Parameters<typeof CommunityFollow.bulkWrite>[0] = [];

    for (const item of items) {
      let targetId: string;
      try {
        targetId = normalizeFollowTargetId(item.kind, item.targetId);
      } catch {
        // A single bad row from an old client must not fail the whole import.
        continue;
      }

      const key = `${item.kind}:${targetId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      operations.push({
        updateOne: {
          filter: { userId, kind: item.kind, targetId },
          update: { $setOnInsert: { userId, kind: item.kind, targetId } },
          upsert: true,
        },
      });

      if (operations.length >= room) {
        break;
      }
    }

    if (operations.length === 0) {
      return { imported: 0 };
    }

    const result = await CommunityFollow.bulkWrite(operations, {
      ordered: false,
    });

    return { imported: result.upsertedCount || 0 };
  },

  async listPosts(
    userId: string | undefined,
    page = 1,
    limit = 20,
    filters?: {
      sort?: "NEW" | "TOP" | "UNANSWERED" | "ANSWERED";
      direction?: "ASC" | "DESC";
      q?: string;
      tag?: string;
      sport?: string;
      city?: string;
      category?: string;
      mine?: boolean;
      authorId?: string;
    },
  ) {
    userId = await resolvePublicViewerId(userId);
    if (userId) {
      const userRole = await getCommunityRole(userId);
      ensureQnaAllowedForRole(userRole);
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;
    const sort = (filters?.sort || "NEW").toUpperCase() as
      "NEW" | "TOP" | "UNANSWERED" | "ANSWERED";
    const direction = (filters?.direction || "DESC").toUpperCase() as
      "ASC" | "DESC";

    const query: Record<string, unknown> = {
      isDeleted: false,
      status: { $in: ["OPEN", "CLOSED"] },
    };

    if (filters?.mine && userId) {
      query.authorId = userId;
    }

    const authorFilter = normalizeOptionalText(filters?.authorId);
    if (authorFilter && mongoose.Types.ObjectId.isValid(authorFilter)) {
      query.authorId = authorFilter;
      if (authorFilter !== userId) {
        // Someone else's posts: anonymous ones stay out. Otherwise this filter
        // becomes a deanonymizer — pass an author id, get back the posts they
        // chose to publish without their name on them.
        query.isAnonymous = { $ne: true };
      }
    }

    const search = (filters?.q || "").trim();
    if (search) {
      query.$text = { $search: search };
    }

    const tag = (filters?.tag || "").trim().toLowerCase();
    if (tag) {
      query.tags = tag;
    }

    const sportValues = splitCsvValues(filters?.sport);
    if (sportValues.length === 1) {
      query.sport = sportValues[0];
    } else if (sportValues.length > 1) {
      query.sport = { $in: sportValues };
    }

    const cityValues = splitCsvValues(filters?.city);
    if (cityValues.length === 1) {
      query.city = cityValues[0];
    } else if (cityValues.length > 1) {
      query.city = { $in: cityValues };
    }

    const category = normalizeOptionalText(filters?.category);
    if (category) {
      query.category = category;
    }

    if (sort === "UNANSWERED") {
      query.answerCount = 0;
    } else if (sort === "ANSWERED") {
      query.answerCount = { $gt: 0 };
    }

    const createdAtOrder = direction === "ASC" ? (1 as const) : (-1 as const);
    const sortClause =
      sort === "TOP"
        ? ({ voteScore: -1 as const, createdAt: createdAtOrder } as const)
        : { createdAt: createdAtOrder };

    const [posts, total] = await Promise.all([
      CommunityPost.find(query)
        .sort(sortClause)
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      CommunityPost.countDocuments(query),
    ]);

    if (!posts.length) {
      return {
        items: [],
        pagination: {
          total,
          page: safePage,
          totalPages: Math.ceil(total / safeLimit),
        },
      };
    }

    const authorIds = posts.map((post) => String(post.authorId));

    const [users, profiles, votes] = await Promise.all([
      User.find({ _id: { $in: authorIds } })
        .select("_id name photoUrl photoS3Key role")
        .lean(),
      CommunityProfile.find({ userId: { $in: authorIds } })
        .select("userId anonymousAlias isIdentityPublic")
        .lean(),
      userId
        ? CommunityVote.find({
            userId,
            targetType: "POST",
            targetId: { $in: posts.map((post) => post._id) },
          })
            .select("targetId value")
            .lean()
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.userId), profile]),
    );
    const voteMap = new Map(votes.map((vote) => [String(vote.targetId), vote]));
    const credentialMap = await resolveCommunityCredentials(
      posts.map((post) => String(post.authorId)),
    );

    return {
      items: await Promise.all(
        posts.map(async (post) => {
          const authorId = String(post.authorId);
          const authorUser = userMap.get(authorId);
          const profile = profileMap.get(authorId);
          const isSelf = Boolean(userId) && authorId === userId;
          const isPostAnon = post.isAnonymous && !isSelf;
          // Anonymous posts carry no badge — a credential is an identity
          // claim, and showing it would narrow who wrote it.
          const credential = isPostAnon
            ? undefined
            : credentialMap.get(authorId);

          return {
            id: String(post._id),
            title: post.title,
            body: post.body,
            tags: post.tags,
            sport: post.sport || "",
            city: post.city || "",
            category: post.category || "General",
            isAnonymous: post.isAnonymous || false,
            status: post.status,
            voteScore: post.voteScore || 0,
            upvoteCount: post.upvoteCount || 0,
            downvoteCount: post.downvoteCount || 0,
            answerCount: post.answerCount || 0,
            viewCount: post.viewCount || 0,
            acceptedAnswerId: post.acceptedAnswerId
              ? String(post.acceptedAnswerId)
              : null,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            myVote: voteMap.get(String(post._id))?.value || 0,
            author: {
              id: isPostAnon ? "anon" : authorId,
              displayName: post.isAnonymous
                ? "Anonymous"
                : isSelf
                  ? authorUser?.name || "Me"
                  : profile?.isIdentityPublic
                    ? authorUser?.name || "Player"
                    : profile?.anonymousAlias || "Anonymous Player",
              isIdentityPublic: post.isAnonymous ? false : (profile?.isIdentityPublic ?? true),
              photoUrl: post.isAnonymous
                ? null
                : profile?.isIdentityPublic && authorUser
                  ? await resolveUserPhotoUrl(authorUser)
                  : null,
              isVerifiedExpert: Boolean(credential),
              expertTitle: credential?.title,
              credentialKind: credential?.kind,
            },
          };
        }),
      ),
      pagination: {
        total,
        page: safePage,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  },

  async getPostDetails(
    userId: string | undefined,
    postId: string,
    page = 1,
    limit = 30,
  ) {
    userId = await resolvePublicViewerId(userId);

    const post = await CommunityPost.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new Error("post not found");
    }

    await CommunityPost.updateOne(
      { _id: post._id },
      { $inc: { viewCount: 1 } },
    );

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [answers, answerTotal, postAuthor, postAuthorProfile, myPostVote] =
      await Promise.all([
        // Aggregate rather than find(): the accepted answer has to sort first
        // on every page, not just be moved to the top of page one — otherwise
        // it disappears below the fold on a thread with 20+ answers.
        CommunityAnswer.aggregate([
          { $match: { postId: post._id, isDeleted: false } },
          {
            $addFields: {
              isAccepted: {
                $eq: ["$_id", post.acceptedAnswerId || null],
              },
            },
          },
          { $sort: { isAccepted: -1, voteScore: -1, createdAt: 1 } },
          { $skip: skip },
          { $limit: safeLimit },
        ]),
        CommunityAnswer.countDocuments({ postId: post._id, isDeleted: false }),
        User.findById(post.authorId)
          .select("_id name photoUrl photoS3Key role")
          .lean(),
        CommunityProfile.findOne({ userId: post.authorId })
          .select("userId anonymousAlias isIdentityPublic")
          .lean(),
        userId
          ? CommunityVote.findOne({
              userId,
              targetType: "POST",
              targetId: post._id,
            })
              .select("value")
              .lean()
          : Promise.resolve(null),
      ]);

    const answerAuthorIds = answers.map((item) => String(item.authorId));
    const [answerUsers, answerProfiles, answerVotes] = await Promise.all([
      User.find({ _id: { $in: answerAuthorIds } })
        .select("_id name photoUrl photoS3Key role")
        .lean(),
      CommunityProfile.find({ userId: { $in: answerAuthorIds } })
        .select("userId anonymousAlias isIdentityPublic")
        .lean(),
      userId
        ? CommunityVote.find({
            userId,
            targetType: "ANSWER",
            targetId: { $in: answers.map((item) => item._id) },
          })
            .select("targetId value")
            .lean()
        : Promise.resolve([]),
    ]);

    const answerUserMap = new Map(
      answerUsers.map((answerUser) => [String(answerUser._id), answerUser]),
    );
    const answerProfileMap = new Map(
      answerProfiles.map((answerProfile) => [
        String(answerProfile.userId),
        answerProfile,
      ]),
    );
    const answerVoteMap = new Map(
      answerVotes.map((answerVote) => [
        String(answerVote.targetId),
        answerVote,
      ]),
    );

    const postAuthorId = String(post.authorId);
    const isPostAuthorSelf = Boolean(userId) && postAuthorId === userId;
    const isPostAnon = post.isAnonymous && !isPostAuthorSelf;

    // Fetched for the whole page at once — a request per answer would be 20
    // round-trips on a busy thread, and comments are small.
    const comments = await CommunityAnswerComment.find({
      answerId: { $in: answers.map((item) => item._id) },
      isDeleted: false,
    })
      .sort({ createdAt: 1 })
      .lean();

    const commentAuthorIds = comments.map((item) => String(item.authorId));

    const credentialMap = await resolveCommunityCredentials([
      postAuthorId,
      ...answerAuthorIds,
      ...commentAuthorIds,
    ]);

    const [commentUsers, commentProfiles] = await Promise.all([
      User.find({ _id: { $in: commentAuthorIds } })
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: commentAuthorIds } })
        .select("userId anonymousAlias isIdentityPublic")
        .lean(),
    ]);
    const commentUserMap = new Map(
      commentUsers.map((item) => [String(item._id), item]),
    );
    const commentProfileMap = new Map(
      commentProfiles.map((item) => [String(item.userId), item]),
    );

    const commentsByAnswer = new Map<string, typeof comments>();
    for (const comment of comments) {
      const key = String(comment.answerId);
      const bucket = commentsByAnswer.get(key);
      if (bucket) {
        bucket.push(comment);
      } else {
        commentsByAnswer.set(key, [comment]);
      }
    }

    const shapeComment = (comment: (typeof comments)[number]) => {
      const commentAuthorId = String(comment.authorId);
      const commentUser = commentUserMap.get(commentAuthorId);
      const commentProfile = commentProfileMap.get(commentAuthorId);
      const isCommentSelf = Boolean(userId) && commentAuthorId === userId;
      const isCommentAnon = comment.isAnonymous && !isCommentSelf;

      return {
        id: String(comment._id),
        answerId: String(comment.answerId),
        postId: String(comment.postId),
        content: comment.content,
        isAnonymous: comment.isAnonymous || false,
        createdAt: comment.createdAt,
        canDelete: isCommentSelf || postAuthorId === userId,
        author: {
          id: isCommentAnon ? "anon" : commentAuthorId,
          displayName: comment.isAnonymous
            ? "Anonymous"
            : isCommentSelf
              ? commentUser?.name || "Me"
              : commentProfile?.isIdentityPublic
                ? commentUser?.name || "Player"
                : commentProfile?.anonymousAlias || "Anonymous Player",
          isIdentityPublic: comment.isAnonymous
            ? false
            : (commentProfile?.isIdentityPublic ?? true),
          photoUrl: null,
        },
      };
    };
    const postAuthorCredential = isPostAnon
      ? undefined
      : credentialMap.get(postAuthorId);

    return {
      post: {
        id: String(post._id),
        title: post.title,
        body: post.body,
        tags: post.tags,
        sport: post.sport || "",
        city: post.city || "",
        category: post.category || "General",
        isAnonymous: post.isAnonymous || false,
        status: post.status,
        voteScore: post.voteScore || 0,
        upvoteCount: post.upvoteCount || 0,
        downvoteCount: post.downvoteCount || 0,
        answerCount: post.answerCount || 0,
        viewCount: (post.viewCount || 0) + 1,
        acceptedAnswerId: post.acceptedAnswerId
          ? String(post.acceptedAnswerId)
          : null,
        // Only the asker sees the accept controls, and an anonymous asker is
        // still the asker — `isPostAuthorSelf` already accounts for that.
        canAccept: isPostAuthorSelf,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        myVote: myPostVote?.value || 0,
        author: {
          id: isPostAnon ? "anon" : postAuthorId,
          displayName: post.isAnonymous
            ? "Anonymous"
            : isPostAuthorSelf
              ? postAuthor?.name || "Me"
              : postAuthorProfile?.isIdentityPublic
                ? postAuthor?.name || "Player"
                : postAuthorProfile?.anonymousAlias || "Anonymous Player",
          isIdentityPublic: post.isAnonymous ? false : (postAuthorProfile?.isIdentityPublic ?? true),
          photoUrl: post.isAnonymous
            ? null
            : postAuthorProfile?.isIdentityPublic && postAuthor
              ? await resolveUserPhotoUrl(postAuthor)
              : null,
          isVerifiedExpert: Boolean(postAuthorCredential),
          expertTitle: postAuthorCredential?.title,
          credentialKind: postAuthorCredential?.kind,
        },
      },
      answers: await Promise.all(
        answers.map(async (answer) => {
          const answerAuthorId = String(answer.authorId);
          const answerUser = answerUserMap.get(answerAuthorId);
          const answerProfile = answerProfileMap.get(answerAuthorId);
          const isAnswerSelf = Boolean(userId) && answerAuthorId === userId;
          const isAnswerAnon = answer.isAnonymous && !isAnswerSelf;
          const answerCredential = isAnswerAnon
            ? undefined
            : credentialMap.get(answerAuthorId);

          return {
            id: String(answer._id),
            postId: String(answer.postId),
            content: answer.content,
            isAnonymous: answer.isAnonymous || false,
            voteScore: answer.voteScore || 0,
            upvoteCount: answer.upvoteCount || 0,
            downvoteCount: answer.downvoteCount || 0,
            createdAt: answer.createdAt,
            updatedAt: answer.updatedAt,
            myVote: answerVoteMap.get(String(answer._id))?.value || 0,
            isAccepted:
              String(post.acceptedAnswerId || "") === String(answer._id),
            comments: (commentsByAnswer.get(String(answer._id)) || []).map(
              shapeComment,
            ),
            author: {
              id: isAnswerAnon ? "anon" : answerAuthorId,
              displayName: answer.isAnonymous
                ? "Anonymous"
                : isAnswerSelf
                  ? answerUser?.name || "Me"
                  : answerProfile?.isIdentityPublic
                    ? answerUser?.name || "Player"
                    : answerProfile?.anonymousAlias || "Anonymous Player",
              isIdentityPublic: answer.isAnonymous ? false : (answerProfile?.isIdentityPublic ?? true),
              photoUrl: answer.isAnonymous
                ? null
                : answerProfile?.isIdentityPublic && answerUser
                  ? await resolveUserPhotoUrl(answerUser)
                  : null,
              isVerifiedExpert: Boolean(answerCredential),
              expertTitle: answerCredential?.title,
              credentialKind: answerCredential?.kind,
            },
          };
        }),
      ),
      pagination: {
        total: answerTotal,
        page: safePage,
        totalPages: Math.ceil(answerTotal / safeLimit),
      },
    };
  },

  async createPost(
    userId: string,
    payload: {
      title: string;
      body: string;
      tags?: string[];
      sport?: string;
      city?: string;
      category?: string;
      isAnonymous?: boolean;
    },
  ) {
    await ensureProfile(userId);
    const userRole = await getCommunityRole(userId);
    ensureQnaAllowedForRole(userRole);

    const post = await CommunityPost.create({
      authorId: userId,
      title: payload.title.trim(),
      body: payload.body.trim(),
      tags: normalizeTags(payload.tags),
      sport: normalizeOptionalText(payload.sport),
      city: normalizeOptionalText(payload.city),
      ...(payload.category ? { category: payload.category } : {}),
      ...(payload.isAnonymous ? { isAnonymous: true } : {}),
    });

    await CommunityReputation.updateOne(
      { userId },
      {
        $setOnInsert: {
          answerCount: 0,
          receivedUpvotes: 0,
        },
        $inc: {
          totalPoints: COMMUNITY_POINTS.CREATE_POST,
          questionCount: 1,
        },
      },
      { upsert: true },
    );

    trackCommunityRoleMixEvent("qna_post_created", {
      userRole,
      userId,
      postId: String(post._id),
    });

    return {
      id: String(post._id),
      title: post.title,
      body: post.body,
      tags: post.tags,
      sport: post.sport || "",
      city: post.city || "",
      status: post.status,
      voteScore: post.voteScore,
      upvoteCount: post.upvoteCount,
      downvoteCount: post.downvoteCount,
      answerCount: post.answerCount,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  },

  async updatePost(
    userId: string,
    postId: string,
    payload: {
      title?: string;
      body?: string;
      tags?: string[];
      status?: "OPEN" | "CLOSED";
      sport?: string;
      city?: string;
    },
  ) {
    await ensureProfile(userId);

    const post = await CommunityPost.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new Error("post not found");
    }

    if (String(post.authorId) !== userId) {
      throw new Error("Only the author can update this post");
    }

    if (typeof payload.title === "string") {
      post.title = payload.title.trim();
    }
    if (typeof payload.body === "string") {
      post.body = payload.body.trim();
    }
    if (Array.isArray(payload.tags)) {
      post.tags = normalizeTags(payload.tags);
    }
    if (payload.status === "OPEN" || payload.status === "CLOSED") {
      post.status = payload.status;
    }
    if (typeof payload.sport === "string") {
      post.sport = normalizeOptionalText(payload.sport);
    }
    if (typeof payload.city === "string") {
      post.city = normalizeOptionalText(payload.city);
    }

    await post.save();

    return {
      id: String(post._id),
      title: post.title,
      body: post.body,
      tags: post.tags,
      sport: post.sport || "",
      city: post.city || "",
      status: post.status,
      voteScore: post.voteScore,
      upvoteCount: post.upvoteCount,
      downvoteCount: post.downvoteCount,
      answerCount: post.answerCount,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  },

  async deletePost(userId: string, postId: string) {
    await ensureProfile(userId);

    const post = await CommunityPost.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new Error("post not found");
    }

    if (String(post.authorId) !== userId) {
      throw new Error("Only the author can delete this post");
    }

    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    return { id: String(post._id), deleted: true };
  },

  async createAnswer(
    userId: string,
    postId: string,
    content: string,
    isAnonymous = false,
  ) {
    await ensureProfile(userId);
    const userRole = await getCommunityRole(userId);
    ensureQnaAllowedForRole(userRole);

    const post = await CommunityPost.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new Error("post not found");
    }

    if (post.status !== "OPEN") {
      throw new Error("Cannot answer a closed post");
    }

    const answer = await CommunityAnswer.create({
      postId: post._id,
      authorId: userId,
      content: content.trim(),
      ...(isAnonymous ? { isAnonymous: true } : {}),
    });

    if (String(post.authorId) !== userId) {
      NotificationService.send({
        userId: String(post.authorId),
        type: "MESSAGE_RECEIVED",
        title: "New answer on your question",
        message: "Someone shared a new answer on your community question.",
        data: {
          postId: String(post._id),
          answerId: String(answer._id),
          actorUserId: userId,
          event: "COMMUNITY_ANSWER_CREATED",
        },
      }).catch((error: unknown) => {
        console.error("Failed to send community answer notification:", error);
      });
    }

    await Promise.all([
      CommunityPost.updateOne({ _id: post._id }, { $inc: { answerCount: 1 } }),
      CommunityReputation.updateOne(
        { userId },
        {
          $setOnInsert: {
            questionCount: 0,
            receivedUpvotes: 0,
          },
          $inc: {
            totalPoints: COMMUNITY_POINTS.CREATE_ANSWER,
            answerCount: 1,
          },
        },
        { upsert: true },
      ),
    ]);

    trackCommunityRoleMixEvent("qna_answer_created", {
      userRole,
      userId,
      postId: String(post._id),
      answerId: String(answer._id),
    });

    return {
      id: String(answer._id),
      postId: String(answer.postId),
      content: answer.content,
      voteScore: answer.voteScore,
      upvoteCount: answer.upvoteCount,
      downvoteCount: answer.downvoteCount,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
    };
  },

  async updateAnswer(userId: string, answerId: string, content: string) {
    await ensureProfile(userId);

    const answer = await CommunityAnswer.findOne({
      _id: answerId,
      isDeleted: false,
    });
    if (!answer) {
      throw new Error("answer not found");
    }

    if (String(answer.authorId) !== userId) {
      throw new Error("Only the author can update this answer");
    }

    answer.content = content.trim();
    await answer.save();

    return {
      id: String(answer._id),
      postId: String(answer.postId),
      content: answer.content,
      voteScore: answer.voteScore,
      upvoteCount: answer.upvoteCount,
      downvoteCount: answer.downvoteCount,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
    };
  },

  async deleteAnswer(userId: string, answerId: string) {
    await ensureProfile(userId);

    const answer = await CommunityAnswer.findOne({
      _id: answerId,
      isDeleted: false,
    });
    if (!answer) {
      throw new Error("answer not found");
    }

    if (String(answer.authorId) !== userId) {
      throw new Error("Only the author can delete this answer");
    }

    answer.isDeleted = true;
    answer.deletedAt = new Date();
    await answer.save();

    await CommunityPost.updateOne(
      { _id: answer.postId, answerCount: { $gt: 0 } },
      { $inc: { answerCount: -1 } },
    );

    // Comments hang off the answer; leaving them behind would orphan them and
    // let a deleted answer's discussion linger on the next page load.
    await CommunityAnswerComment.updateMany(
      { answerId: answer._id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );

    // A deleted answer must not stay marked as the accepted one — the post
    // would keep a "solved" badge pointing at content nobody can read, and the
    // author would keep points for it.
    const clearedAccepted = await CommunityPost.findOneAndUpdate(
      { _id: answer.postId, acceptedAnswerId: answer._id },
      { $set: { acceptedAnswerId: null } },
    );

    if (clearedAccepted) {
      await adjustAcceptedAnswerReputation(String(answer.authorId), -1);
    }

    return {
      id: String(answer._id),
      postId: String(answer.postId),
      deleted: true,
    };
  },

  async createAnswerComment(
    userId: string,
    answerId: string,
    content: string,
    isAnonymous = false,
  ) {
    await ensureProfile(userId);
    const userRole = await getCommunityRole(userId);
    ensureQnaAllowedForRole(userRole);

    const answer = await CommunityAnswer.findOne({
      _id: answerId,
      isDeleted: false,
    })
      .select("_id postId authorId")
      .lean();
    if (!answer) {
      throw new Error("answer not found");
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Comment cannot be empty");
    }

    const comment = await CommunityAnswerComment.create({
      answerId: answer._id,
      postId: answer.postId,
      authorId: new mongoose.Types.ObjectId(userId),
      content: trimmed,
      isAnonymous,
    });

    // No reputation for commenting, by design — a comment carries no score, so
    // there is nothing to farm. Anything worth points belongs in an answer.
    if (String(answer.authorId) !== userId) {
      sendCommunityNotification(
        String(answer.authorId),
        "New comment on your answer",
        "Someone replied to your answer.",
        {
          event: "COMMUNITY_ANSWER_COMMENTED",
          postId: String(answer.postId),
          targetId: String(answer._id),
          targetType: "ANSWER",
          actorUserId: userId,
        },
      );
    }

    return {
      id: String(comment._id),
      answerId: String(comment.answerId),
      postId: String(comment.postId),
      content: comment.content,
      isAnonymous: comment.isAnonymous,
      createdAt: comment.createdAt,
    };
  },

  /**
   * Removable by whoever wrote it, and by whoever asked the question — the
   * asker owns their thread and needs a way to clear noise off it without
   * waiting on a moderator.
   */
  async deleteAnswerComment(userId: string, commentId: string) {
    await ensureProfile(userId);

    const comment = await CommunityAnswerComment.findOne({
      _id: commentId,
      isDeleted: false,
    });
    if (!comment) {
      throw new Error("comment not found");
    }

    if (String(comment.authorId) !== userId) {
      const post = await CommunityPost.findById(comment.postId)
        .select("authorId")
        .lean();
      if (!post || String(post.authorId) !== userId) {
        throw new Error("You cannot delete this comment");
      }
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    return {
      id: String(comment._id),
      answerId: String(comment.answerId),
      postId: String(comment.postId),
      deleted: true,
    };
  },

  /**
   * Marks an answer as the one that solved the question, or clears it when the
   * same answer is passed again. Only the asker can do this — including on
   * their own anonymous post, where they are still the author server-side.
   */
  async acceptAnswer(userId: string, postId: string, answerId: string) {
    await ensureProfile(userId);

    const post = await CommunityPost.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      throw new Error("post not found");
    }

    if (String(post.authorId) !== userId) {
      throw new Error("Only the person who asked can accept an answer");
    }

    const answer = await CommunityAnswer.findOne({
      _id: answerId,
      postId: post._id,
      isDeleted: false,
    });
    if (!answer) {
      throw new Error("answer not found");
    }

    const answerAuthorId = String(answer.authorId);
    const wasAccepted = String(post.acceptedAnswerId || "") === String(answer._id);
    const previouslyAcceptedId = post.acceptedAnswerId;

    post.acceptedAnswerId = wasAccepted ? null : answer._id;
    await post.save();

    if (wasAccepted) {
      await adjustAcceptedAnswerReputation(answerAuthorId, -1);
    } else {
      // Switching from another answer: take the points back from the previous
      // author before awarding the new one, or accepting repeatedly inflates
      // reputation across the thread.
      if (previouslyAcceptedId) {
        const previous = await CommunityAnswer.findById(previouslyAcceptedId)
          .select("authorId")
          .lean();
        if (previous) {
          await adjustAcceptedAnswerReputation(String(previous.authorId), -1);
        }
      }

      await adjustAcceptedAnswerReputation(answerAuthorId, 1);

      if (answerAuthorId !== userId) {
        sendCommunityNotification(
          answerAuthorId,
          "Your answer was accepted",
          `Your answer was marked as the solution on "${post.title}".`,
          {
            event: "COMMUNITY_ANSWER_ACCEPTED",
            postId: String(post._id),
            targetId: String(answer._id),
            targetType: "ANSWER",
            actorUserId: userId,
          },
        );
      }
    }

    return {
      postId: String(post._id),
      answerId: String(answer._id),
      accepted: !wasAccepted,
      acceptedAnswerId: post.acceptedAnswerId
        ? String(post.acceptedAnswerId)
        : null,
    };
  },

  async vote(
    userId: string,
    payload: {
      targetType: "POST" | "ANSWER";
      targetId: string;
      value: 1 | -1;
    },
  ) {
    await ensureProfile(userId);

    if (!mongoose.Types.ObjectId.isValid(payload.targetId)) {
      throw new Error("Invalid target ID");
    }

    let targetAuthorId = "";

    if (payload.targetType === "POST") {
      const post = await CommunityPost.findOne({
        _id: payload.targetId,
        isDeleted: false,
      }).select("_id authorId");
      if (!post) {
        throw new Error("post not found");
      }
      targetAuthorId = String(post.authorId);
    } else {
      const answer = await CommunityAnswer.findOne({
        _id: payload.targetId,
        isDeleted: false,
      }).select("_id authorId");
      if (!answer) {
        throw new Error("answer not found");
      }
      targetAuthorId = String(answer.authorId);
    }

    if (targetAuthorId === userId) {
      throw new Error("You cannot vote on your own content");
    }

    const existingVote = await CommunityVote.findOne({
      userId,
      targetType: payload.targetType,
      targetId: payload.targetId,
    });

    const previousValue = (existingVote?.value as 1 | -1 | undefined) || null;
    const nextValue = previousValue === payload.value ? null : payload.value;
    const deltas = getVoteTransitionDeltas(previousValue, nextValue);

    if (nextValue === null) {
      if (existingVote?._id) {
        await CommunityVote.deleteOne({ _id: existingVote._id });
      }
    } else if (!existingVote) {
      await CommunityVote.create({
        userId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        value: nextValue,
      });
    } else {
      existingVote.value = nextValue;
      await existingVote.save();
    }

    if (payload.targetType === "POST") {
      await CommunityPost.updateOne(
        { _id: payload.targetId },
        {
          $inc: {
            voteScore: deltas.voteScore,
            upvoteCount: deltas.upvoteCount,
            downvoteCount: deltas.downvoteCount,
          },
        },
      );
    } else {
      await CommunityAnswer.updateOne(
        { _id: payload.targetId },
        {
          $inc: {
            voteScore: deltas.voteScore,
            upvoteCount: deltas.upvoteCount,
            downvoteCount: deltas.downvoteCount,
          },
        },
      );
    }

    if (deltas.upvoteCount !== 0) {
      await CommunityReputation.updateOne(
        { userId: targetAuthorId },
        {
          $setOnInsert: {
            questionCount: 0,
            answerCount: 0,
          },
          $inc: {
            totalPoints: deltas.upvoteCount * COMMUNITY_POINTS.RECEIVE_UPVOTE,
            receivedUpvotes: deltas.upvoteCount,
          },
        },
        { upsert: true },
      );
    }

    const updatedTarget =
      payload.targetType === "POST"
        ? await CommunityPost.findById(payload.targetId)
            .select("voteScore upvoteCount downvoteCount")
            .lean()
        : await CommunityAnswer.findById(payload.targetId)
            .select("voteScore upvoteCount downvoteCount postId")
            .lean();

    if (nextValue === 1 && previousValue !== 1) {
      NotificationService.send({
        userId: targetAuthorId,
        type: "MESSAGE_RECEIVED",
        title: "Your answer helped someone",
        message: "You received a new upvote on your community content.",
        data: {
          targetType: payload.targetType,
          targetId: payload.targetId,
          actorUserId: userId,
          event: "COMMUNITY_UPVOTE_RECEIVED",
          postId:
            payload.targetType === "ANSWER"
              ? String(
                  (updatedTarget as { postId?: mongoose.Types.ObjectId })
                    ?.postId || "",
                )
              : payload.targetId,
        },
      }).catch((error: unknown) => {
        console.error("Failed to send community upvote notification:", error);
      });
    }

    return {
      targetType: payload.targetType,
      targetId: payload.targetId,
      myVote: nextValue || 0,
      voteScore: updatedTarget?.voteScore || 0,
      upvoteCount: updatedTarget?.upvoteCount || 0,
      downvoteCount: updatedTarget?.downvoteCount || 0,
      postId:
        payload.targetType === "ANSWER"
          ? String(
              (updatedTarget as { postId?: mongoose.Types.ObjectId })?.postId ||
                "",
            )
          : payload.targetId,
    };
  },

  async searchPlayers(
    userId: string,
    query: string,
    limit = 10,
    roleFilter?: string,
  ) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery && !roleFilter) {
      return [];
    }

    const safeLimit = Math.min(20, Math.max(1, limit));
    const profile = await ensureProfile(userId);

    const userMatchCriteria: any = {
      _id: { $ne: userId },
      role: roleFilter ? roleFilter : { $in: COMMUNITY_ALLOWED_ROLES },
    };
    if (normalizedQuery) {
      userMatchCriteria.name = new RegExp(escapeRegex(normalizedQuery), "i");
    }

    const profileMatchCriteria: any = { userId: { $ne: userId } };
    if (normalizedQuery) {
      profileMatchCriteria.anonymousAlias = new RegExp(
        escapeRegex(normalizedQuery),
        "i",
      );
    }

    const [nameMatches, aliasMatches] = await Promise.all([
      User.find(userMatchCriteria)
        .select("_id name photoUrl photoS3Key")
        .limit(safeLimit * 3)
        .lean(),
      normalizedQuery
        ? CommunityProfile.find(profileMatchCriteria)
            .select("userId")
            .limit(safeLimit * 3)
            .lean()
        : Promise.resolve([]),
    ]);

    const candidateIds = new Set<string>();
    for (const user of nameMatches) {
      candidateIds.add(String(user._id));
    }
    for (const match of aliasMatches) {
      candidateIds.add(String(match.userId));
    }

    const ids = Array.from(candidateIds);
    if (!ids.length) {
      return [];
    }

    const [users, profiles] = await Promise.all([
      User.find({ _id: { $in: ids }, role: { $in: COMMUNITY_ALLOWED_ROLES } })
        .select("_id name photoUrl photoS3Key role city dob")
        .lean(),
      CommunityProfile.find({ userId: { $in: ids } })
        .select("userId anonymousAlias isIdentityPublic blockedUsers")
        .lean(),
    ]);

    const blockedByMe = new Set(profile.blockedUsers.map((id) => String(id)));
    const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

    const items = await Promise.all(
      users
        .filter((user) => {
          const candidateId = String(user._id);
          if (blockedByMe.has(candidateId)) {
            return false;
          }

          const candidateProfile = profileMap.get(candidateId);
          const blockedMe = Boolean(
            candidateProfile?.blockedUsers?.some(
              (blockedUserId) => String(blockedUserId) === userId,
            ),
          );

          return !blockedMe;
        })
        .map((user) => {
          const candidateId = String(user._id);
          const candidateProfile = profileMap.get(candidateId);
          const isIdentityPublic = candidateProfile?.isIdentityPublic ?? true;
          const displayName = isIdentityPublic
            ? user.name
            : candidateProfile?.anonymousAlias || "Anonymous Member";
          const sports: string[] = [];

          return {
            id: candidateId,
            displayName,
            isIdentityPublic,
            role: user.role,
            photoUrl: null,
            city: typeof user.city === "string" ? user.city.trim() : null,
            age: calculateAge(user.dob),
            sports,
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, safeLimit),
    ).then((items) =>
      Promise.all(
        items.map(async (item) => ({
          ...item,
          photoUrl: item.id
            ? await resolveUserPhotoUrl(
                users.find((user) => String(user._id) === item.id),
              )
            : null,
        })),
      ),
    );

    return items;
  },

  async getPlayerProfile(viewerId: string, targetUserId: string) {
    if (!targetUserId) {
      throw new Error("Player not found");
    }

    await ensureProfile(viewerId);

    const [targetUser, targetProfile] = await Promise.all([
      User.findById(targetUserId)
        .select(
          "_id name photoUrl photoS3Key role dob city createdAt lastActiveAt",
        )
        .lean(),
      CommunityProfile.findOne({ userId: targetUserId })
        .select(
          "userId anonymousAlias isIdentityPublic messagePrivacy readReceiptsEnabled lastSeenVisible lastSeenAt blockedUsers",
        )
        .lean(),
    ]);

    const targetRole = targetUser?.role as
      (typeof COMMUNITY_ALLOWED_ROLES)[number] | undefined;

    if (
      !targetUser ||
      !targetRole ||
      !COMMUNITY_ALLOWED_ROLES.includes(targetRole)
    ) {
      throw new Error("Player not found");
    }

    if (
      targetProfile?.blockedUsers?.some(
        (blockedId) => String(blockedId) === viewerId,
      )
    ) {
      throw new Error("Access denied");
    }

    const profile = targetProfile || {
      anonymousAlias: "Anonymous Member",
      isIdentityPublic: true,
      messagePrivacy: "EVERYONE" as const,
      readReceiptsEnabled: true,
      lastSeenVisible: false,
      lastSeenAt: undefined,
    };
    const isSelf = targetUserId === viewerId;
    const isIdentityPublic = isSelf || Boolean(profile.isIdentityPublic);

    return {
      id: String(targetUser._id),
      role: targetUser.role,
      displayName: isIdentityPublic
        ? targetUser.name
        : profile.anonymousAlias || "Anonymous Member",
      alias: profile.anonymousAlias || "Anonymous Member",
      isIdentityPublic,
      photoUrl: await resolveUserPhotoUrl(targetUser),
      sports: [],
      city: typeof targetUser.city === "string" ? targetUser.city.trim() : null,
      age: calculateAge(targetUser.dob),
      dob: isIdentityPublic ? targetUser.dob || null : null,
      createdAt: targetUser.createdAt,
      lastActiveAt:
        isIdentityPublic || Boolean(profile.lastSeenVisible)
          ? targetUser.lastActiveAt || null
          : null,
      messagePrivacy: profile.messagePrivacy,
      readReceiptsEnabled: Boolean(profile.readReceiptsEnabled),
      lastSeenVisible: Boolean(profile.lastSeenVisible),
      lastSeenAt: profile.lastSeenVisible ? profile.lastSeenAt || null : null,
    };
  },

  async getMyProfile(userId: string) {
    const profile = await ensureProfile(userId);
    return profile.toObject();
  },

  async updateMyProfile(
    userId: string,
    payload: {
      isIdentityPublic?: boolean;
      messagePrivacy?: CommunityMessagePrivacy;
      readReceiptsEnabled?: boolean;
      lastSeenVisible?: boolean;
      anonymousAlias?: string;
    },
  ) {
    const profile = await ensureProfile(userId);

    if (typeof payload.isIdentityPublic === "boolean") {
      profile.isIdentityPublic = payload.isIdentityPublic;
    }

    if (payload.messagePrivacy) {
      profile.messagePrivacy = payload.messagePrivacy;
    }

    if (typeof payload.readReceiptsEnabled === "boolean") {
      profile.readReceiptsEnabled = payload.readReceiptsEnabled;
    }

    if (typeof payload.lastSeenVisible === "boolean") {
      profile.lastSeenVisible = payload.lastSeenVisible;
    }

    if (payload.anonymousAlias?.trim()) {
      profile.anonymousAlias = payload.anonymousAlias.trim();
    }

    await profile.save();
    return profile.toObject();
  },

  async blockUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new Error("You cannot block yourself");
    }

    await Promise.all([
      ensureProfile(userId),
      ensureCommunityUser(targetUserId),
    ]);

    await CommunityProfile.updateOne(
      { userId },
      { $addToSet: { blockedUsers: targetUserId } },
    );

    return { blockedUserId: targetUserId };
  },

  async unblockUser(userId: string, targetUserId: string) {
    await ensureProfile(userId);

    await CommunityProfile.updateOne(
      { userId },
      { $pull: { blockedUsers: targetUserId } },
    );

    return { unblockedUserId: targetUserId };
  },

  async getBlockedUsers(userId: string) {
    const profile = await ensureProfile(userId);
    const users = await User.find({ _id: { $in: profile.blockedUsers } })
      .select("_id name photoUrl photoS3Key")
      .lean();

    return Promise.all(
      users.map(async (user) => ({
        id: String(user._id),
        name: user.name,
        photoUrl: await resolveUserPhotoUrl(user),
      })),
    );
  },

  async listGroups(userId: string | undefined, query = "", limit = 20) {
    userId = await resolvePublicViewerId(userId);

    const normalizedQuery = query.trim();
    const safeLimit = Math.min(50, Math.max(1, limit));
    const regex = normalizedQuery
      ? new RegExp(escapeRegex(normalizedQuery), "i")
      : null;

    // PRIVATE groups are unlisted, so discovery only ever shows PUBLIC and
    // INVITE_ONLY. A private group the user is already in still reaches them
    // through their conversation list, which is keyed on membership.
    const discoverable = { $in: ["PUBLIC", "INVITE_ONLY"] };
    const filter = regex
      ? {
          visibility: discoverable,
          $or: [{ name: regex }, { sport: regex }, { city: regex }],
        }
      : { visibility: discoverable };

    const groups = await CommunityGroup.find(filter)
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    const membership = await membershipMapFor(
      userId,
      groups.map((group) => String(group._id)),
    );

    return Promise.all(
      groups.map(async (group) => {
        const role = membership.get(String(group._id));
        return {
          id: String(group._id),
          name: group.name,
          description: group.description || "",
          visibility: group.visibility,
          audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
          sport: group.sport || "",
          city: group.city || "",
          createdBy: String(group.createdBy),
          profilePicture: await resolveGroupPhotoUrl(group),
          memberCount: group.memberCount || 0,
          isMember: Boolean(role),
          isAdmin: role === "ADMIN",
          isOwner: userId ? String(group.createdBy) === userId : false,
          memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
        };
      }),
    );
  },

  async createGroup(
    userId: string,
    payload: {
      name: string;
      description?: string;
      sport?: string;
      city?: string;
      profilePicture?: string;
      profilePictureKey?: string;
      audience?: CommunityGroupAudience;
      visibility?: CommunityGroupVisibility;
    },
  ) {
    await ensureProfile(userId);

    const creatorRole = await getCommunityRole(userId);

    const name = payload.name.trim();
    if (!name) {
      throw new Error("Group name is required");
    }

    const group = await CommunityGroup.findOneAndUpdate(
      { createdBy: new mongoose.Types.ObjectId(userId), name },
      {
        $setOnInsert: {
          name,
          description: normalizeOptionalText(payload.description),
          sport: payload.sport || "",
          city: payload.city || "",
          profilePicture: payload.profilePicture || "",
          profilePictureKey: payload.profilePictureKey || "",
          visibility: payload.visibility || "PUBLIC",
          memberAddPolicy: "ADMIN_ONLY",
          audience: payload.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
          createdBy: new mongoose.Types.ObjectId(userId),
          memberCount: 0,
          inviteCode: generateInviteCode(),
        },
      },
      { upsert: true, new: true },
    );

    // The creator is the first member and its first admin. `addMember` is a
    // no-op on the upsert path where the group already existed, so re-creating
    // a group by the same name does not double-count them.
    await addMember(String(group._id), userId, "ADMIN");

    trackCommunityRoleMixEvent("group_created", {
      groupId: String(group._id),
      createdByRole: creatorRole,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
    });

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
          participantKey: buildGroupParticipantKey(String(group._id)),
          participants: [new mongoose.Types.ObjectId(userId)],
          status: "ACTIVE",
          requestedBy: new mongoose.Types.ObjectId(userId),
          lastMessageAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    return {
      id: String(group._id),
      name: group.name,
      description: group.description || "",
      visibility: group.visibility,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
      sport: group.sport || "",
      city: group.city || "",
      createdBy: String(group.createdBy),
      profilePicture: await resolveGroupPhotoUrl(group),
      memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
      memberCount: await countMembers(String(group._id)),
      isMember: true,
      isAdmin: true,
      isOwner: true,
      conversationId: String(conversation._id),
    };
  },

  async updateGroup(
    userId: string,
    groupId: string,
    payload: {
      name?: string;
      description?: string;
      sport?: string;
      city?: string;
      profilePicture?: string;
      profilePictureKey?: string;
      audience?: "ALL" | "PLAYERS_ONLY" | "COACHES_ONLY";
      visibility?: CommunityGroupVisibility;
    },
  ) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    if (!(await isGroupAdmin(groupId, userId))) {
      throw new Error("Only group admins can update the group");
    }

    if (payload.name) group.name = payload.name;
    if (typeof payload.description === "string") group.description = payload.description;
    if (typeof payload.sport === "string") group.sport = payload.sport;
    if (typeof payload.city === "string") group.city = payload.city;
    if (typeof payload.profilePicture === "string") group.profilePicture = payload.profilePicture;
    if (typeof payload.profilePictureKey === "string") group.profilePictureKey = payload.profilePictureKey;
    if (payload.audience) group.audience = payload.audience;
    if (payload.visibility) group.visibility = payload.visibility;

    await group.save();

    const [memberCount, role] = await Promise.all([
      countMembers(groupId),
      getMemberRole(groupId, userId),
    ]);

    return {
      id: String(group._id),
      groupId: String(group._id),
      name: group.name,
      description: group.description || "",
      visibility: group.visibility,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
      sport: group.sport || "",
      city: group.city || "",
      createdBy: String(group.createdBy),
      profilePicture: await resolveGroupPhotoUrl(group),
      memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
      memberCount,
      isMember: Boolean(role),
      isAdmin: role === "ADMIN",
      isOwner: String(group.createdBy) === userId,
    };
  },

  async updateGroupSettings(
    userId: string,
    groupId: string,
    payload: { memberAddPolicy: "ADMIN_ONLY" | "ANY_MEMBER" },
  ) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    if (!(await isGroupAdmin(groupId, userId))) {
      throw new Error("Only group admins can update settings");
    }

    group.memberAddPolicy = payload.memberAddPolicy;
    await group.save();

    return {
      groupId: String(group._id),
      memberAddPolicy: group.memberAddPolicy,
    };
  },

  async joinGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const userRole = await getCommunityRole(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const groupAudience =
      (group.audience as CommunityGroupAudience | undefined) ||
      COMMUNITY_DEFAULT_GROUP_AUDIENCE;
    if (!canJoinGroupAudience(groupAudience, userRole)) {
      throw new Error("This group is not available for your role");
    }

    // Self-service joining is a PUBLIC-only affair. INVITE_ONLY groups are
    // discoverable so they can be found and asked about, but getting in still
    // needs a code or an admin; PRIVATE ones are not listed at all.
    const alreadyMember = await isGroupMember(groupId, userId);
    if (!alreadyMember && group.visibility !== "PUBLIC") {
      throw new Error(
        "This group is invite-only. Ask an admin for an invite link.",
      );
    }

    if (!alreadyMember) {
      await addMember(groupId, userId);

      trackCommunityRoleMixEvent("group_joined", {
        groupId,
        audience: groupAudience,
        role: userRole,
      });
    }

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
          participantKey: buildGroupParticipantKey(String(group._id)),
          status: "ACTIVE",
          requestedBy: group.createdBy,
          lastMessageAt: new Date(),
        },
        $addToSet: {
          participants: new mongoose.Types.ObjectId(userId),
        },
      },
      { upsert: true, new: true },
    );

    if (!alreadyMember) {
      const adminIds = (await listAdminIds(groupId)).filter(
        (adminId) => adminId !== userId,
      );

      for (const adminId of adminIds) {
        sendCommunityNotification(
          adminId,
          "New group member",
          `A new member joined ${group.name}.`,
          {
            event: "COMMUNITY_GROUP_JOINED",
            groupId: String(group._id),
            conversationId: String(conversation?._id || ""),
            actorUserId: userId,
          },
        );
      }
    }

    return {
      groupId: String(group._id),
      conversationId: String(conversation?._id || ""),
      memberCount: await countMembers(groupId),
    };
  },

  async deleteGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const isCreator = String(group.createdBy) === userId;
    const isAdmin = await isGroupAdmin(groupId, userId);

    if (!isCreator && !isAdmin) {
      throw new Error("Only group admins can delete the group");
    }

    const groupConversation = await CommunityConversation.findOne({
      conversationType: "GROUP",
      groupId: group._id,
    });

    if (groupConversation) {
      await Promise.all([
        CommunityMessage.deleteMany({
          conversationId: groupConversation._id,
        }),
        CommunityConversation.deleteOne({ _id: groupConversation._id }),
      ]);
    }

    await Promise.all([
      CommunityGroup.deleteOne({ _id: group._id }),
      removeAllMembers(groupId),
    ]);

    return { groupId: String(group._id), deletedGroup: true };
  },

  async leaveGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const wasMember = await removeMember(groupId, userId);
    if (!wasMember) {
      return { groupId, removed: false };
    }

    // Promote someone if that was the last admin, or everyone still in the
    // group is locked out of settings, invites and deletion.
    await ensureGroupHasAdmin(groupId);
    const remainingMembers = await countMembers(groupId);

    const groupConversation = await CommunityConversation.findOne({
      conversationType: "GROUP",
      groupId: group._id,
    });

    if (groupConversation) {
      groupConversation.participants = groupConversation.participants.filter(
        (participantId) => String(participantId) !== userId,
      );

      if (!groupConversation.participants.length || remainingMembers === 0) {
        await Promise.all([
          CommunityMessage.deleteMany({
            conversationId: groupConversation._id,
          }),
          CommunityConversation.deleteOne({ _id: groupConversation._id }),
        ]);
      } else {
        await groupConversation.save();
      }
    }

    if (remainingMembers === 0) {
      await Promise.all([
        CommunityGroup.deleteOne({ _id: group._id }),
        removeAllMembers(groupId),
      ]);
      return { groupId: String(group._id), removed: true, deletedGroup: true };
    }

    const remainingAdminIds = (await listAdminIds(groupId)).filter(
      (adminId) => adminId !== userId,
    );

    for (const adminId of remainingAdminIds) {
      sendCommunityNotification(
        adminId,
        "Member left group",
        `A member left ${group.name}.`,
        {
          event: "COMMUNITY_GROUP_LEFT",
          groupId: String(group._id),
          actorUserId: userId,
        },
      );
    }

    return { groupId: String(group._id), removed: true, deletedGroup: false };
  },

  async addGroupMember(userId: string, groupId: string, targetUserId: string) {
    await Promise.all([
      ensureProfile(userId),
      ensureCommunityUser(targetUserId),
    ]);

    if (userId === targetUserId) {
      throw new Error("Use join group to add yourself");
    }

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const [requesterRole, targetRole] = await Promise.all([
      getCommunityRole(userId),
      getCommunityRole(targetUserId),
    ]);

    const groupAudience =
      (group.audience as CommunityGroupAudience | undefined) ||
      COMMUNITY_DEFAULT_GROUP_AUDIENCE;
    if (!canJoinGroupAudience(groupAudience, targetRole)) {
      throw new Error("This group is not available for the selected user role");
    }

    if (isCrossRoleInteraction(requesterRole, targetRole)) {
      ensurePolicyAllowed(
        COMMUNITY_INTERACTION_POLICY.allowCrossRoleGroupMembership,
        "Cross-role group membership is currently disabled",
      );
      trackCommunityRoleMixEvent("group_cross_role_invite", {
        groupId,
        audience: groupAudience,
        requesterRole,
        targetRole,
      });
    }

    const requesterRoleInGroup = await getMemberRole(groupId, userId);
    const requesterIsAdmin = requesterRoleInGroup === "ADMIN";
    if (!requesterRoleInGroup) {
      throw new Error("Only group members can add members");
    }

    const memberAddPolicy = group.memberAddPolicy || "ADMIN_ONLY";
    if (memberAddPolicy === "ADMIN_ONLY" && !requesterIsAdmin) {
      throw new Error("Only group admins can add members");
    }

    const blocked = await isBlockedBetween(userId, targetUserId);
    if (blocked) {
      throw new Error("Cannot add this user due to privacy settings");
    }

    // `addMember` reports whether a row was actually inserted, so this stays
    // correct if two admins add the same person at once.
    const added = await addMember(groupId, targetUserId);
    const alreadyMember = !added;

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
          participantKey: buildGroupParticipantKey(String(group._id)),
          status: "ACTIVE",
          requestedBy: group.createdBy,
          lastMessageAt: new Date(),
        },
        $addToSet: {
          participants: new mongoose.Types.ObjectId(targetUserId),
        },
      },
      { upsert: true, new: true },
    );

    if (!alreadyMember && targetUserId !== userId) {
      sendCommunityNotification(
        targetUserId,
        "You were added to a group",
        `${group.name} added you to the community discussion.`,
        {
          event: "COMMUNITY_GROUP_MEMBER_ADDED",
          groupId: String(group._id),
          conversationId: String(conversation?._id || ""),
          actorUserId: userId,
        },
      );
    }

    return {
      groupId: String(group._id),
      conversationId: String(conversation?._id || ""),
      memberCount: await countMembers(groupId),
      addedUserId: targetUserId,
      alreadyMember,
    };
  },

  async startConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new Error("You cannot chat with yourself");
    }

    const [meProfile, targetProfile] = await Promise.all([
      ensureProfile(userId),
      ensureProfile(targetUserId),
    ]);

    const [requesterRole, targetRole] = await Promise.all([
      getCommunityRole(userId),
      getCommunityRole(targetUserId),
    ]);

    if (isCrossRoleInteraction(requesterRole, targetRole)) {
      ensurePolicyAllowed(
        COMMUNITY_INTERACTION_POLICY.allowCrossRoleDm,
        `Direct messages between ${ROLE_LABEL[requesterRole]} and ${ROLE_LABEL[targetRole]} accounts are currently disabled`,
      );
      trackCommunityRoleMixEvent("dm_cross_role_start", {
        requesterRole,
        targetRole,
      });
    }

    const blocked = await isBlockedBetween(userId, targetUserId);
    if (blocked) {
      throw new Error("Conversation unavailable due to privacy settings");
    }

    if (targetProfile.messagePrivacy === "NONE") {
      throw new Error("This player is not accepting new messages");
    }

    const participantKey = buildParticipantKey(userId, targetUserId);
    const existingConversation = await CommunityConversation.findOne({
      participantKey,
    });
    if (existingConversation) {
      return {
        id: String(existingConversation._id),
        status: existingConversation.status,
        requestedBy: String(existingConversation.requestedBy),
        myAlias: meProfile.anonymousAlias,
      };
    }

    const initialStatus =
      targetProfile.messagePrivacy === "REQUEST_ONLY" ? "PENDING" : "ACTIVE";

    const conversation = await CommunityConversation.findOneAndUpdate(
      { participantKey },
      {
        $setOnInsert: {
          conversationType: "DM",
          participantKey,
          participants: [userId, targetUserId],
          status: initialStatus,
          requestedBy: userId,
          lastMessageAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    if (!conversation) {
      throw new Error("Failed to start conversation");
    }

    if (targetUserId !== userId) {
      sendCommunityNotification(
        targetUserId,
        initialStatus === "PENDING"
          ? "New message request"
          : "New conversation started",
        initialStatus === "PENDING"
          ? "Someone wants to connect with you in community chat."
          : "Someone started a conversation with you.",
        {
          event:
            initialStatus === "PENDING"
              ? "COMMUNITY_CONVERSATION_REQUESTED"
              : "COMMUNITY_CONVERSATION_STARTED",
          conversationId: String(conversation._id),
          actorUserId: userId,
        },
      );
    }

    return {
      id: String(conversation._id),
      status: conversation.status,
      requestedBy: String(conversation.requestedBy),
      myAlias: meProfile.anonymousAlias,
    };
  },

  async acceptConversationRequest(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.conversationType === "GROUP") {
      throw new Error("Group conversations do not require acceptance");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    if (conversation.status === "PENDING") {
      const requester = String(conversation.requestedBy);
      if (requester === userId) {
        throw new Error("Requester cannot accept own request");
      }
      conversation.status = "ACTIVE";
      await conversation.save();

      sendCommunityNotification(
        requester,
        "Message request accepted",
        "Your community conversation request was accepted.",
        {
          event: "COMMUNITY_CONVERSATION_ACCEPTED",
          conversationId: String(conversation._id),
          actorUserId: userId,
        },
      );
    }

    return { id: String(conversation._id), status: conversation.status };
  },

  async rejectConversationRequest(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.conversationType === "GROUP") {
      throw new Error("Group conversations do not support rejection");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const requester = String(conversation.requestedBy);
    if (requester === userId) {
      throw new Error("Requester cannot reject own request");
    }

    sendCommunityNotification(
      requester,
      "Message request declined",
      "Your community conversation request was declined.",
      {
        event: "COMMUNITY_CONVERSATION_REJECTED",
        conversationId: String(conversation._id),
        actorUserId: userId,
      },
    );

    await Promise.all([
      CommunityMessage.deleteMany({ conversationId: conversation._id }),
      CommunityConversation.deleteOne({ _id: conversation._id }),
    ]);

    return { rejected: true };
  },

  async getUnreadConversationCount(userId: string): Promise<number> {
    const conversations = await CommunityConversation.find({
      participants: userId,
    })
      .select("_id")
      .lean();

    if (!conversations.length) {
      return 0;
    }

    const result = await CommunityMessage.aggregate([
      {
        $match: {
          conversationId: { $in: conversations.map((c) => c._id) },
          senderId: { $ne: new mongoose.Types.ObjectId(userId) },
          readBy: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      { $count: "count" },
    ]);

    return result[0]?.count || 0;
  },

  async listConversations(
    userId: string,
    page = 1,
    limit = 25,
    filters?: {
      mode?: "ALL" | "UNREAD" | "REQUESTS";
      type?: "ALL" | "CONTACTS" | "GROUPS";
      search?: string;
    },
  ) {
    await ensureProfile(userId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const mode = filters?.mode || "ALL";
    const type = filters?.type || "ALL";
    const normalizedSearch = (filters?.search || "").trim().toLowerCase();
    const requiresInMemoryFiltering =
      mode !== "ALL" || normalizedSearch.length > 0;

    const conversationQuery: {
      participants: string;
      conversationType?: "GROUP" | { $ne: "GROUP" };
    } = {
      participants: userId,
    };
    if (type === "GROUPS") {
      conversationQuery.conversationType = "GROUP";
    } else if (type === "CONTACTS") {
      conversationQuery.conversationType = { $ne: "GROUP" };
    }

    let total = 0;
    let conversations: any[] = [];

    if (requiresInMemoryFiltering) {
      conversations = await CommunityConversation.find(conversationQuery)
        .sort({ updatedAt: -1 })
        .lean();
      total = conversations.length;
    } else {
      total = await CommunityConversation.countDocuments(conversationQuery);
      conversations = await CommunityConversation.find(conversationQuery)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean();
    }

    if (!conversations.length) {
      return {
        items: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          hasMore: skip + conversations.length < total,
        },
      };
    }

    const dmConversations = conversations.filter(
      (conversation) => conversation.conversationType !== "GROUP",
    );

    const otherParticipantIds = dmConversations.map((conversation) => {
      const other = conversation.participants.find(
        (participantId: mongoose.Types.ObjectId) =>
          String(participantId) !== userId,
      );
      return String(other);
    });

    const groupConversationIds = conversations
      .filter((conversation) => conversation.conversationType === "GROUP")
      .map((conversation) => String(conversation.groupId || ""))
      .filter(Boolean);

    const [users, profiles, latestMessages, groups] = await Promise.all([
      User.find({ _id: { $in: otherParticipantIds } })
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: otherParticipantIds } })
        .select(
          "userId anonymousAlias isIdentityPublic lastSeenVisible lastSeenAt",
        )
        .lean(),
      CommunityMessage.aggregate([
        {
          $match: { conversationId: { $in: conversations.map((c) => c._id) } },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$conversationId",
            content: { $first: "$content" },
            createdAt: { $first: "$createdAt" },
            senderId: { $first: "$senderId" },
            type: { $first: "$type" },
            isDeleted: { $first: "$isDeleted" },
          },
        },
      ]),
      CommunityGroup.find({ _id: { $in: groupConversationIds } })
        .select("_id name description visibility sport city memberCount")
        .lean(),
    ]);

    const unreadStats = await CommunityMessage.aggregate([
      {
        $match: {
          conversationId: {
            $in: conversations.map((conversation) => conversation._id),
          },
          senderId: { $ne: new mongoose.Types.ObjectId(userId) },
          readBy: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $group: {
          _id: "$conversationId",
          unreadCount: { $sum: 1 },
        },
      },
    ]);

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.userId), profile]),
    );
    const messageMap = new Map(
      latestMessages.map((message) => [String(message._id), message]),
    );
    const unreadMap = new Map(
      unreadStats.map((item) => [
        String(item._id),
        Number(item.unreadCount) || 0,
      ]),
    );
    const groupMap = new Map(groups.map((group) => [String(group._id), group]));

    const mappedItems = await Promise.all(
      conversations.map(async (conversation) => {
        const conversationType = conversation.conversationType || "DM";
        const otherId = String(
          conversation.participants.find(
            (participantId: mongoose.Types.ObjectId) =>
              String(participantId) !== userId,
          ),
        );
        const otherUser = userMap.get(otherId);
        const otherProfile = profileMap.get(otherId);
        const latest = messageMap.get(String(conversation._id));
        const group = conversation.groupId
          ? groupMap.get(String(conversation.groupId))
          : null;
        const groupMemberCount = group?.memberCount || 0;

        return {
          id: String(conversation._id),
          conversationType,
          status: conversation.status,
          requestedBy: String(conversation.requestedBy),
          otherParticipant: {
            id:
              conversationType === "GROUP" ? String(group?._id || "") : otherId,
            displayName:
              conversationType === "GROUP"
                ? group?.name || "Community Group"
                : otherProfile?.isIdentityPublic
                  ? otherUser?.name || "Player"
                  : otherProfile?.anonymousAlias || "Anonymous Player",
            isIdentityPublic:
              conversationType === "GROUP"
                ? true
                : (otherProfile?.isIdentityPublic ?? true),
            photoUrl:
              conversationType === "GROUP"
                ? null
                : otherProfile?.isIdentityPublic && otherUser
                  ? await resolveUserPhotoUrl(otherUser)
                  : null,
            lastSeenAt:
              conversationType === "GROUP"
                ? null
                : otherProfile?.lastSeenVisible
                  ? otherProfile?.lastSeenAt || null
                  : null,
          },
          group:
            conversationType === "GROUP"
              ? {
                  id: String(group?._id || ""),
                  name: group?.name || "Community Group",
                  description: group?.description || "",
                  visibility: group?.visibility || "PUBLIC",
                  sport: group?.sport || "",
                  city: group?.city || "",
                  memberCount: groupMemberCount,
                }
              : null,
          latestMessage: latest
            ? {
                content: latest.isDeleted
                  ? "Message deleted"
                  : latest.type === "IMAGE"
                    ? "📷 Image"
                    : latest.content,
                createdAt: latest.createdAt,
                senderId: String(latest.senderId),
                type: latest.type || "TEXT",
              }
            : null,
          unreadCount: unreadMap.get(String(conversation._id)) || 0,
          updatedAt: conversation.updatedAt,
        };
      }),
    );

    const filteredItems = mappedItems.filter((conversation) => {
      const modeMatches =
        mode === "UNREAD"
          ? conversation.unreadCount > 0
          : mode === "REQUESTS"
            ? conversation.status === "PENDING" &&
              conversation.conversationType !== "GROUP"
            : true;

      if (!modeMatches) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const displayName = conversation.otherParticipant.displayName
        .toLowerCase()
        .trim();
      const latestMessage = (conversation.latestMessage?.content || "")
        .toLowerCase()
        .trim();
      return (
        displayName.includes(normalizedSearch) ||
        latestMessage.includes(normalizedSearch)
      );
    });

    const pagedItems = requiresInMemoryFiltering
      ? filteredItems.slice(skip, skip + safeLimit)
      : filteredItems;
    const effectiveTotal = requiresInMemoryFiltering
      ? filteredItems.length
      : total;

    return {
      items: pagedItems,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: effectiveTotal,
        hasMore: skip + pagedItems.length < effectiveTotal,
      },
    };
  },

  async listRecentConversationIdsForRealtime(userId: string, limit = 30) {
    await ensureProfile(userId);

    const safeLimit = Math.min(100, Math.max(1, limit));
    const conversations = await CommunityConversation.find(
      {
        participants: userId,
      },
      { _id: 1 },
    )
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    return conversations.map((conversation) => String(conversation._id));
  },

  async markConversationRead(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const unreadMessages = await CommunityMessage.find({
      conversationId,
      senderId: { $ne: new mongoose.Types.ObjectId(userId) },
      readBy: { $ne: new mongoose.Types.ObjectId(userId) },
    })
      .select("_id")
      .lean();

    if (!unreadMessages.length) {
      return {
        conversationId: String(conversation._id),
        participantIds: conversation.participants.map((participantId) =>
          String(participantId),
        ),
        readerId: userId,
        messageIds: [] as string[],
      };
    }

    await CommunityMessage.updateMany(
      {
        _id: { $in: unreadMessages.map((message) => message._id) },
      },
      {
        $addToSet: { readBy: new mongoose.Types.ObjectId(userId) },
      },
    );

    return {
      conversationId: String(conversation._id),
      participantIds: conversation.participants.map((participantId) =>
        String(participantId),
      ),
      readerId: userId,
      messageIds: unreadMessages.map((message) => String(message._id)),
    };
  },

  async markConversationDelivered(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const undeliveredMessages = await CommunityMessage.find({
      conversationId,
      senderId: { $ne: new mongoose.Types.ObjectId(userId) },
      deliveredTo: { $ne: new mongoose.Types.ObjectId(userId) },
    })
      .select("_id")
      .lean();

    if (!undeliveredMessages.length) {
      return {
        conversationId: String(conversation._id),
        participantIds: conversation.participants.map((participantId) =>
          String(participantId),
        ),
        readerId: userId,
        messageIds: [] as string[],
      };
    }

    await CommunityMessage.updateMany(
      {
        _id: { $in: undeliveredMessages.map((message) => message._id) },
      },
      {
        $addToSet: { deliveredTo: new mongoose.Types.ObjectId(userId) },
      },
    );

    return {
      conversationId: String(conversation._id),
      participantIds: conversation.participants.map((participantId) =>
        String(participantId),
      ),
      readerId: userId,
      messageIds: undeliveredMessages.map((message) => String(message._id)),
    };
  },

  async getMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 30,
  ) {
    const conversation =
      await CommunityConversation.findById(conversationId).lean();
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const [messages, total] = await Promise.all([
      CommunityMessage.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommunityMessage.countDocuments({ conversationId }),
    ]);

    const allParticipantIds = conversation.participants.map((id) => String(id));
    const users = await User.find({ _id: { $in: allParticipantIds } })
      .select("_id name photoUrl photoS3Key")
      .lean();
    const profiles = await CommunityProfile.find({
      userId: { $in: allParticipantIds },
    })
      .select("userId anonymousAlias isIdentityPublic readReceiptsEnabled")
      .lean();

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.userId), profile]),
    );

    // One query for every quoted message on the page, rather than a lookup per
    // message. Quotes are resolved live rather than snapshotted at send time,
    // so an edit to the original shows through and a deletion is visible.
    const replyTargetIds = messages.flatMap((message) =>
      message.replyToId ? [message.replyToId] : [],
    );
    const replyTargets = replyTargetIds.length
      ? await CommunityMessage.find({ _id: { $in: replyTargetIds } })
          .select("_id senderId type content isDeleted")
          .lean()
      : [];
    const replyTargetMap = new Map(
      replyTargets.map((target) => [String(target._id), target]),
    );

    const shapeReplyPreview = (replyToId?: mongoose.Types.ObjectId | null) => {
      if (!replyToId) {
        return null;
      }

      const target = replyTargetMap.get(String(replyToId));
      if (!target) {
        return null;
      }

      const targetSenderId = String(target.senderId);
      const targetProfile = profileMap.get(targetSenderId);
      const targetUser = userMap.get(targetSenderId);

      return {
        id: String(target._id),
        senderId: targetSenderId,
        senderDisplayName:
          targetSenderId === userId
            ? targetUser?.name || "Me"
            : targetProfile?.isIdentityPublic
              ? targetUser?.name || "Player"
              : targetProfile?.anonymousAlias || "Anonymous Player",
        type: target.type || "TEXT",
        // An image quote shows a label, never the S3 key that `content` holds.
        content: target.isDeleted
          ? "Message deleted"
          : target.type === "IMAGE"
            ? "Photo"
            : (target.content || "").slice(0, 140),
        isDeleted: Boolean(target.isDeleted),
      };
    };

    const messageItems = messages.reverse().map((message) => {
      const senderId = String(message.senderId);
      const sender = userMap.get(senderId);
      const senderProfile = profileMap.get(senderId);
      const isSelf = senderId === userId;
      const readBy = (message.readBy || [])
        .map((readerId) => String(readerId))
        .filter((readerId) => {
          if (readerId === userId) {
            return true;
          }

          const readerProfile = profileMap.get(readerId);
          return readerProfile?.readReceiptsEnabled !== false;
        });

      return {
        id: String(message._id),
        conversationId: String(message.conversationId),
        conversationType: conversation.conversationType || "DM",
        senderId,
        type: message.type || "TEXT",
        senderDisplayName: isSelf
          ? sender?.name || "Me"
          : senderProfile?.isIdentityPublic
            ? sender?.name || "Player"
            : senderProfile?.anonymousAlias || "Anonymous Player",
        content: message.isDeleted ? "Message deleted" : message.content,
        metadata: message.metadata || null,
        replyTo: shapeReplyPreview(message.replyToId),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        editedAt: message.editedAt || null,
        isEdited: Boolean(message.editedAt),
        isDeleted: Boolean(message.isDeleted),
        readBy,
        participantIds: allParticipantIds,
      };
    });

    const conversationType = conversation.conversationType || "DM";
    const group =
      conversationType === "GROUP" && conversation.groupId
        ? await CommunityGroup.findById(conversation.groupId)
            .select("_id name description visibility sport city memberCount")
            .lean()
        : null;

    return {
      conversation: {
        id: String(conversation._id),
        conversationType,
        status: conversation.status,
        requestedBy: String(conversation.requestedBy),
        group:
          conversationType === "GROUP"
            ? {
                id: String(group?._id || ""),
                name: group?.name || "Community Group",
                description: group?.description || "",
                visibility: group?.visibility || "PUBLIC",
                sport: group?.sport || "",
                city: group?.city || "",
                memberCount: group?.memberCount || 0,
              }
            : null,
      },
      messages: messageItems,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async sendMessage(
    userId: string,
    conversationId: string,
    content: string,
    options?: {
      type?: "TEXT" | "IMAGE";
      metadata?: { width?: number; height?: number };
      replyToId?: string;
    },
  ) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    if (conversation.conversationType !== "GROUP") {
      const otherParticipantId = String(
        conversation.participants.find(
          (participantId) => String(participantId) !== userId,
        ),
      );

      const otherProfile = await ensureProfile(otherParticipantId);
      if (otherProfile.messagePrivacy === "NONE") {
        throw new Error("This player is not accepting new messages");
      }

      const blocked = await isBlockedBetween(userId, otherParticipantId);
      if (blocked) {
        throw new Error("Message blocked due to privacy settings");
      }
    }

    if (
      conversation.status === "PENDING" &&
      conversation.conversationType !== "GROUP"
    ) {
      const requester = String(conversation.requestedBy);
      if (requester !== userId) {
        throw new Error("Please accept this message request first");
      }
    }

    const messageType = options?.type || "TEXT";
    const messageDoc: Record<string, unknown> = {
      conversationId,
      senderId: userId,
      type: messageType,
      content: messageType === "TEXT" ? content.trim() : content,
      readBy: [new mongoose.Types.ObjectId(userId)],
    };
    if (messageType === "IMAGE" && options?.metadata) {
      messageDoc.metadata = options.metadata;
    }

    // The quoted message has to live in this conversation. Without the check a
    // client could quote a message out of a chat it cannot read, and the quote
    // preview would leak its text to everyone here.
    if (options?.replyToId) {
      const replyTarget = await CommunityMessage.findOne({
        _id: options.replyToId,
        conversationId: conversation._id,
        isDeleted: false,
      })
        .select("_id")
        .lean();
      if (!replyTarget) {
        throw new Error("The message you replied to is no longer available");
      }
      messageDoc.replyToId = replyTarget._id;
    }

    const message = await CommunityMessage.create(messageDoc);

    conversation.lastMessageAt = new Date();
    await conversation.save();

    const participants = await User.find({
      _id: { $in: conversation.participants },
    })
      .select("_id name photoUrl photoS3Key")
      .lean();
    const profiles = await CommunityProfile.find({
      userId: { $in: conversation.participants },
    })
      .select("userId anonymousAlias isIdentityPublic")
      .lean();

    const sender = participants.find(
      (participant) => String(participant._id) === userId,
    );
    const senderProfile = profiles.find(
      (profile) => String(profile.userId) === userId,
    );

    const senderDisplayName = senderProfile?.isIdentityPublic
      ? sender?.name || "Player"
      : senderProfile?.anonymousAlias || "Anonymous Player";

    const otherParticipantIds = conversation.participants
      .map((participantId) => String(participantId))
      .filter((participantId) => participantId !== userId);

    // Enqueue a single outbox delivery job to handle multi-channel fanout
    try {
      await OutboxMessage.create({
        type: "deliver_message",
        payload: {
          conversationId: String(conversation._id),
          messageId: String(message._id),
          actorUserId: userId,
          conversationType: conversation.conversationType || "DM",
          participantIds: otherParticipantIds,
          summary:
            messageType === "IMAGE"
              ? `${senderDisplayName} shared an image in community chat.`
              : `${senderDisplayName} sent you a message in community chat.`,
        },
        status: "PENDING",
        attempts: 0,
      });
    } catch (err) {
      console.error("Failed to enqueue outbox delivery:", err);
      // Fallback to best-effort direct notifications if enqueue fails
      for (const participantId of otherParticipantIds) {
        sendCommunityNotification(
          participantId,
          conversation.conversationType === "GROUP"
            ? "New group message"
            : "New message",
          messageType === "IMAGE"
            ? `${senderDisplayName} shared an image in community chat.`
            : `${senderDisplayName} sent you a message in community chat.`,
          {
            event: "COMMUNITY_MESSAGE_RECEIVED",
            conversationId: String(conversation._id),
            messageId: String(message._id),
            actorUserId: userId,
            conversationType: conversation.conversationType || "DM",
          },
        );
      }
    }

    // The sender already has the quoted message on screen, but the payload is
    // broadcast to everyone in the conversation, so the preview has to travel
    // with it or their bubble renders a reply to nothing.
    const replyPreview = message.replyToId
      ? await (async () => {
          const target = await CommunityMessage.findById(message.replyToId)
            .select("_id senderId type content isDeleted")
            .lean();
          if (!target) {
            return null;
          }
          const targetSenderId = String(target.senderId);
          const targetProfile = profiles.find(
            (profile) => String(profile.userId) === targetSenderId,
          );
          const targetUser = participants.find(
            (participant) => String(participant._id) === targetSenderId,
          );
          return {
            id: String(target._id),
            senderId: targetSenderId,
            senderDisplayName: targetProfile?.isIdentityPublic
              ? targetUser?.name || "Player"
              : targetProfile?.anonymousAlias || "Anonymous Player",
            type: target.type || "TEXT",
            content: target.isDeleted
              ? "Message deleted"
              : target.type === "IMAGE"
                ? "Photo"
                : (target.content || "").slice(0, 140),
            isDeleted: Boolean(target.isDeleted),
          };
        })()
      : null;

    return {
      id: String(message._id),
      conversationId: String(message.conversationId),
      conversationType: conversation.conversationType || "DM",
      senderId: String(message.senderId),
      type: message.type || "TEXT",
      senderDisplayName,
      content: message.content,
      metadata: message.metadata || null,
      replyTo: replyPreview,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      editedAt: null,
      isEdited: false,
      isDeleted: false,
      readBy: [String(message.senderId)],
      participantIds: conversation.participants.map((participantId) =>
        String(participantId),
      ),
    };
  },

  async editMessage(userId: string, messageId: string, content: string) {
    const message = await CommunityMessage.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const senderId = String(message.senderId);
    if (senderId !== userId) {
      throw new Error("Only the sender can edit this message");
    }

    if (message.isDeleted) {
      throw new Error("Deleted messages cannot be edited");
    }

    if (
      Date.now() - message.createdAt.getTime() >
      MESSAGE_EDIT_DELETE_WINDOW_MS
    ) {
      throw new Error("Message edit window has expired");
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error("Message content is required");
    }

    message.content = trimmedContent;
    message.editedAt = new Date();
    await message.save();

    const conversation = await CommunityConversation.findById(
      message.conversationId,
    )
      .select("participants conversationType")
      .lean();

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participants = conversation.participants.map((participantId) =>
      String(participantId),
    );

    return {
      id: String(message._id),
      conversationId: String(message.conversationId),
      conversationType: conversation.conversationType || "DM",
      senderId,
      type: message.type || "TEXT",
      content: message.content,
      metadata: message.metadata || null,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      editedAt: message.editedAt,
      isEdited: true,
      isDeleted: false,
      readBy: (message.readBy || []).map((readerId) => String(readerId)),
      participantIds: participants,
    };
  },

  async deleteMessage(userId: string, messageId: string) {
    const message = await CommunityMessage.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const senderId = String(message.senderId);
    if (senderId !== userId) {
      throw new Error("Only the sender can delete this message");
    }

    if (message.isDeleted) {
      throw new Error("Message already deleted");
    }

    if (
      Date.now() - message.createdAt.getTime() >
      MESSAGE_EDIT_DELETE_WINDOW_MS
    ) {
      throw new Error("Message delete window has expired");
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = new mongoose.Types.ObjectId(userId);
    message.content = "Message deleted";
    await message.save();

    const conversation = await CommunityConversation.findById(
      message.conversationId,
    )
      .select("participants conversationType")
      .lean();

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participants = conversation.participants.map((participantId) =>
      String(participantId),
    );

    return {
      id: String(message._id),
      conversationId: String(message.conversationId),
      conversationType: conversation.conversationType || "DM",
      senderId,
      type: message.type || "TEXT",
      content: "Message deleted",
      metadata: null,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      editedAt: message.editedAt || null,
      isEdited: Boolean(message.editedAt),
      isDeleted: true,
      readBy: (message.readBy || []).map((readerId) => String(readerId)),
      participantIds: participants,
    };
  },

  async createReport(
    userId: string,
    payload: {
      targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
      targetId: string;
      reason: string;
      details?: string;
    },
  ) {
    await ensureProfile(userId);

    let messageAudit:
      | {
          senderId?: string;
          createdAt?: Date;
          updatedAt?: Date;
          editedAt?: Date | null;
          deletedAt?: Date | null;
          wasEdited: boolean;
          wasDeleted: boolean;
        }
      | undefined;

    if (payload.targetType === "MESSAGE") {
      const message = await CommunityMessage.findById(payload.targetId)
        .select("_id senderId createdAt updatedAt editedAt deletedAt isDeleted")
        .lean();
      if (!message) {
        throw new Error("message not found");
      }

      messageAudit = {
        senderId: String(message.senderId),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        editedAt: message.editedAt || null,
        deletedAt: message.deletedAt || null,
        wasEdited: Boolean(message.editedAt),
        wasDeleted: Boolean(message.isDeleted),
      };
    } else if (payload.targetType === "GROUP") {
      const group = await CommunityGroup.findById(payload.targetId)
        .select("_id")
        .lean();
      if (!group) {
        throw new Error("group not found");
      }
    } else if (payload.targetType === "POST") {
      const post = await CommunityPost.findById(payload.targetId)
        .select("_id")
        .lean();
      if (!post) {
        throw new Error("post not found");
      }
    } else {
      const answer = await CommunityAnswer.findById(payload.targetId)
        .select("_id")
        .lean();
      if (!answer) {
        throw new Error("answer not found");
      }
    }

    const report = await CommunityReport.create({
      reporterUserId: userId,
      targetType: payload.targetType,
      targetId: payload.targetId,
      reason: payload.reason.trim(),
      details: payload.details?.trim() || "",
      ...(messageAudit ? { messageAudit } : {}),
      status: "OPEN",
    });

    return {
      id: String(report._id),
      status: report.status,
      targetType: report.targetType,
      createdAt: report.createdAt,
    };
  },

  async listMyReports(userId: string, page = 1, limit = 20) {
    await ensureProfile(userId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      CommunityReport.find({ reporterUserId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      CommunityReport.countDocuments({ reporterUserId: userId }),
    ]);

    return {
      items: items.map((item) => ({
        id: String(item._id),
        targetType: item.targetType,
        targetId: String(item.targetId),
        reason: item.reason,
        details: item.details || "",
        status: item.status,
        resolutionNote: item.resolutionNote || "",
        createdAt: item.createdAt,
        reviewedAt: item.reviewedAt || null,
        messageAudit: item.messageAudit
          ? {
              senderId: item.messageAudit.senderId
                ? String(item.messageAudit.senderId)
                : undefined,
              createdAt: item.messageAudit.createdAt || null,
              updatedAt: item.messageAudit.updatedAt || null,
              editedAt: item.messageAudit.editedAt || null,
              deletedAt: item.messageAudit.deletedAt || null,
              wasEdited: Boolean(item.messageAudit.wasEdited),
              wasDeleted: Boolean(item.messageAudit.wasDeleted),
            }
          : undefined,
      })),
      pagination: {
        total,
        page: safePage,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  },

  async touchLastSeen(userId: string) {
    await CommunityProfile.updateOne(
      { userId },
      { $set: { lastSeenAt: new Date() } },
      { upsert: true },
    );
  },

  async assertConversationAccess(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    return conversation;
  },

  formatSocketParticipant(
    selfId: string,
    participant: {
      _id: mongoose.Types.ObjectId;
      name: string;
      photoUrl?: string;
      profile?: {
        anonymousAlias: string;
        isIdentityPublic: boolean;
        lastSeenVisible: boolean;
        lastSeenAt?: Date;
      };
    },
  ) {
    return formatParticipant(selfId, participant);
  },

  async getParticipantIds(conversation: CommunityConversationDocument) {
    return conversation.participants.map((participantId) =>
      String(participantId),
    );
  },

  async getGroupMembers(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId).select("_id").lean();
    if (!group) {
      throw new Error("Group not found");
    }

    if (!(await isGroupMember(groupId, userId))) {
      throw new Error("Access denied");
    }

    const memberRows = await CommunityGroupMember.find({ groupId })
      .select("userId role")
      .sort({ createdAt: 1 })
      .lean();

    const memberIds = memberRows.map((row) => String(row.userId));

    const [users, memberProfiles] = await Promise.all([
      User.find({ _id: { $in: memberIds } })
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: memberIds } })
        .select(
          "userId anonymousAlias isIdentityPublic photoUrl photoS3Key lastSeenAt",
        )
        .lean(),
    ]);

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(
      memberProfiles.map((profile) => [String(profile.userId), profile]),
    );

    return Promise.all(
      memberRows.map(async (row) => {
        const memberId = String(row.userId);
        const member = userMap.get(memberId);
        const profile = profileMap.get(memberId);
        const isIdentityPublic = profile?.isIdentityPublic ?? true;

        return {
          id: memberId,
          name: member?.name || "Unknown",
          displayName: isIdentityPublic
            ? member?.name || "Unknown"
            : profile?.anonymousAlias || "Anonymous",
          photoUrl:
            isIdentityPublic && member
              ? await resolveUserPhotoUrl(member)
              : null,
          isIdentityPublic,
          alias: profile?.anonymousAlias || "Anonymous",
          role: row.role,
        };
      }),
    );
  },

  async joinGroupByCode(userId: string, inviteCode: string) {
    await ensureProfile(userId);
    const userRole = await getCommunityRole(userId);

    const group = await CommunityGroup.findOne({
      inviteCode: inviteCode.trim(),
    });

    if (!group) {
      throw new Error("Invalid invite code");
    }

    const groupAudience =
      (group.audience as CommunityGroupAudience | undefined) ||
      COMMUNITY_DEFAULT_GROUP_AUDIENCE;
    if (!canJoinGroupAudience(groupAudience, userRole)) {
      const userRoleLabel = ROLE_LABEL[userRole] || userRole;
      const audienceLabel =
        groupAudience === "PLAYERS_ONLY" ? "players" : "coaches";
      throw new Error(
        `This group is for ${audienceLabel} only. As a ${userRoleLabel}, you cannot join this group.`,
      );
    }

    const groupId = String(group._id);
    const alreadyMember = await isGroupMember(groupId, userId);
    if (alreadyMember) {
      // Already a member, just return the group info
      const conversation = await CommunityConversation.findOne({
        conversationType: "GROUP",
        groupId: group._id,
      });

      return {
        groupId,
        conversationId: String(conversation?._id || ""),
        memberCount: await countMembers(groupId),
      };
    }

    // An invite code is the way into an INVITE_ONLY or PRIVATE group, so no
    // visibility check here — holding the code is the permission.
    await addMember(groupId, userId);

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
          status: "ACTIVE",
          requestedBy: group.createdBy,
          lastMessageAt: new Date(),
        },
        $addToSet: {
          participants: new mongoose.Types.ObjectId(userId),
        },
      },
      { upsert: true, new: true },
    );

    const adminIds = (await listAdminIds(groupId)).filter(
      (adminId) => adminId !== userId,
    );

    for (const adminId of adminIds) {
      sendCommunityNotification(
        adminId,
        "New member joined via invite",
        `A member joined ${group.name} using an invite code.`,
        {
          event: "COMMUNITY_GROUP_JOINED",
          groupId: String(group._id),
          conversationId: String(conversation?._id || ""),
          actorUserId: userId,
        },
      );
    }

    return {
      groupId,
      conversationId: String(conversation?._id || ""),
      memberCount: await countMembers(groupId),
    };
  },

  async getGroupInviteCode(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    if (!(await isGroupAdmin(groupId, userId))) {
      throw new Error("Only group admins can get invite code");
    }

    let inviteCode =
      typeof group.inviteCode === "string" ? group.inviteCode.trim() : "";
    if (!inviteCode) {
      do {
        inviteCode = generateInviteCode();
      } while (await CommunityGroup.exists({ inviteCode }));

      group.inviteCode = inviteCode;
      await group.save();
    }

    return {
      groupId: String(group._id),
      inviteCode,
    };
  },

  async getCommunityPulseStats() {
    const [postsCount, groupsCount] = await Promise.all([
      CommunityPost.countDocuments(),
      CommunityGroup.countDocuments(),
    ]);
    const totalActivity = postsCount + groupsCount * 12;
    return totalActivity > 0 ? totalActivity : 1280;
  },
};
