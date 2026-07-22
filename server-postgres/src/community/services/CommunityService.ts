import { Prisma } from "@prisma/client";
import type {
  CommunityProfile as CommunityProfileRow,
  CommunityBlockedUser,
  CommunityConversation as CommunityConversationRow,
} from "@prisma/client";
import prisma from "../../lib/prisma";
import { NotificationService } from "../../client/services/NotificationService";
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

// Preserved from the former ../models/CommunityProfile export so the public
// method signatures below stay identical to the Mongoose version.
type CommunityMessagePrivacy = "EVERYONE" | "REQUEST_ONLY" | "NONE";

// A profile with its normalized child collection loaded (blockedUsers is now a
// junction table, not an embedded ObjectId array).
type ProfileWithBlocked = CommunityProfileRow & {
  blockedUsers: CommunityBlockedUser[];
};

// Shape returned by assertConversationAccess and consumed by the realtime layer.
type ConversationWithParticipants = CommunityConversationRow & {
  participants: { userId: string }[];
};

const buildParticipantKey = (a: string, b: string): string =>
  [a, b].sort().join(":");

const buildGroupParticipantKey = (groupId: string): string =>
  `group:${groupId}`;

const normalizeOptionalText = (value?: string): string => value?.trim() || "";

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

const MESSAGE_EDIT_DELETE_WINDOW_MS = 30 * 60 * 1000;
const COMMUNITY_ALLOWED_ROLES = ["Player", "Coach", "Parent"] as const;
const COMMUNITY_DEFAULT_GROUP_AUDIENCE = "ALL" as const;
const COMMUNITY_POINTS = {
  CREATE_POST: 5,
  CREATE_ANSWER: 8,
  RECEIVE_UPVOTE: 2,
} as const;

const s3Service = new S3Service();

const resolveUserPhotoUrl = async (user?: {
  photoUrl?: string | null;
  photoS3Key?: string | null;
} | null): Promise<string | null> => {
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

// Reconstruct the (previously embedded) message metadata object from the
// flattened meta* columns, preserving the old `null | { width, height }` shape.
const buildMessageMetadata = (message: {
  metaWidth: number | null;
  metaHeight: number | null;
  metaCaption: string | null;
}): { width?: number; height?: number; caption?: string } | null => {
  if (
    message.metaWidth == null &&
    message.metaHeight == null &&
    message.metaCaption == null
  ) {
    return null;
  }

  const metadata: { width?: number; height?: number; caption?: string } = {};
  if (message.metaWidth != null) metadata.width = message.metaWidth;
  if (message.metaHeight != null) metadata.height = message.metaHeight;
  if (message.metaCaption != null) metadata.caption = message.metaCaption;
  return metadata;
};

// Reconstruct the (previously embedded) socialLinks object + blockedUsers array
// so getMyProfile/updateMyProfile keep returning the old document shape.
const serializeProfile = (
  profile: CommunityProfileRow & { blockedUsers?: { blockedUserId: string }[] },
) => ({
  id: profile.id,
  userId: profile.userId,
  anonymousAlias: profile.anonymousAlias,
  isIdentityPublic: profile.isIdentityPublic,
  messagePrivacy: profile.messagePrivacy,
  readReceiptsEnabled: profile.readReceiptsEnabled,
  lastSeenVisible: profile.lastSeenVisible,
  lastSeenAt: profile.lastSeenAt ?? undefined,
  username: profile.username ?? undefined,
  bio: profile.bio,
  socialLinks: {
    youtube: profile.slYoutube,
    instagram: profile.slInstagram,
    facebook: profile.slFacebook,
    twitter: profile.slTwitter,
    github: profile.slGithub,
    website: profile.slWebsite,
  },
  blockedUsers: (profile.blockedUsers ?? []).map((blocked) => blocked.blockedUserId),
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true },
  });
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
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const ensureProfile = async (userId: string): Promise<ProfileWithBlocked> => {
  const user = await ensureCommunityUser(userId);

  try {
    return await prisma.communityProfile.upsert({
      where: { userId },
      create: {
        userId,
        anonymousAlias: makeDefaultAlias(user.name),
      },
      update: {},
      include: { blockedUsers: true },
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existingProfile = await prisma.communityProfile.findUnique({
      where: { userId },
      include: { blockedUsers: true },
    });
    if (existingProfile) {
      return existingProfile;
    }

    throw new Error("Failed to initialize community profile");
  }
};

const isBlockedBetween = async (
  userA: string,
  userB: string,
): Promise<boolean> => {
  const [a, b] = await Promise.all([
    prisma.communityProfile.findUnique({
      where: { userId: userA },
      select: { blockedUsers: { select: { blockedUserId: true } } },
    }),
    prisma.communityProfile.findUnique({
      where: { userId: userB },
      select: { blockedUsers: { select: { blockedUserId: true } } },
    }),
  ]);

  const aBlockedB = Boolean(
    a?.blockedUsers?.some((blocked) => blocked.blockedUserId === userB),
  );
  const bBlockedA = Boolean(
    b?.blockedUsers?.some((blocked) => blocked.blockedUserId === userA),
  );

  return aBlockedB || bBlockedA;
};

const formatParticipant = (
  selfId: string,
  participant: {
    _id: unknown;
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

    const reputation = await prisma.communityReputation.upsert({
      where: { userId },
      create: {
        userId,
        totalPoints: 0,
        questionCount: 0,
        answerCount: 0,
        receivedUpvotes: 0,
      },
      update: {},
    });

    return {
      userId,
      totalPoints: reputation?.totalPoints || 0,
      questionCount: reputation?.questionCount || 0,
      answerCount: reputation?.answerCount || 0,
      receivedUpvotes: reputation?.receivedUpvotes || 0,
    };
  },

  async listPosts(
    userId: string,
    page = 1,
    limit = 20,
    filters?: {
      sort?: "NEW" | "TOP" | "UNANSWERED";
      q?: string;
      tag?: string;
      sport?: string;
      city?: string;
      category?: string;
      mine?: boolean;
    },
  ) {
    await ensureProfile(userId);
    const userRole = await getCommunityRole(userId);
    ensureQnaAllowedForRole(userRole);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;
    const sort = (filters?.sort || "NEW").toUpperCase() as
      "NEW" | "TOP" | "UNANSWERED";

    const where: Prisma.CommunityPostWhereInput = {
      isDeleted: false,
      status: { in: ["OPEN", "CLOSED"] },
    };

    if (filters?.mine) {
      where.authorId = userId;
    }

    const search = (filters?.q || "").trim();
    if (search) {
      // TODO(prisma): full-text — tsvector/GIN. Was a Mongo $text index over
      // title/body/tags; approximated here with case-insensitive contains.
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    const tag = (filters?.tag || "").trim().toLowerCase();
    if (tag) {
      where.tags = { has: tag };
    }

    const sportValues = splitCsvValues(filters?.sport);
    if (sportValues.length === 1) {
      const sportValue = sportValues[0];
      if (sportValue !== undefined) {
        where.sport = sportValue;
      }
    } else if (sportValues.length > 1) {
      where.sport = { in: sportValues };
    }

    const cityValues = splitCsvValues(filters?.city);
    if (cityValues.length === 1) {
      const cityValue = cityValues[0];
      if (cityValue !== undefined) {
        where.city = cityValue;
      }
    } else if (cityValues.length > 1) {
      where.city = { in: cityValues };
    }

    const category = normalizeOptionalText(filters?.category);
    if (category) {
      where.category = category;
    }

    if (sort === "UNANSWERED") {
      where.answerCount = 0;
    }

    const orderBy: Prisma.CommunityPostOrderByWithRelationInput[] =
      sort === "TOP"
        ? [{ voteScore: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy,
        skip,
        take: safeLimit,
      }),
      prisma.communityPost.count({ where }),
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

    const authorIds = posts.map((post) => post.authorId);
    const postIds = posts.map((post) => post.id);

    const [users, profiles, votes] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, photoUrl: true, photoS3Key: true, role: true },
      }),
      prisma.communityProfile.findMany({
        where: { userId: { in: authorIds } },
        select: { userId: true, anonymousAlias: true, isIdentityPublic: true },
      }),
      prisma.communityVote.findMany({
        where: {
          userId,
          targetType: "POST",
          targetId: { in: postIds },
        },
        select: { targetId: true, value: true },
      }),
    ]);

    const userMap = new Map(users.map((user) => [user.id, user]));
    const profileMap = new Map(
      profiles.map((profile) => [profile.userId, profile]),
    );
    const voteMap = new Map(votes.map((vote) => [vote.targetId, vote]));

    return {
      items: await Promise.all(
        posts.map(async (post) => {
          const authorId = post.authorId;
          const authorUser = userMap.get(authorId);
          const profile = profileMap.get(authorId);
          const isSelf = authorId === userId;
          const isPostAnon = post.isAnonymous && !isSelf;
          const isVerifiedExpert = !isPostAnon && authorUser?.role === "Coach";

          return {
            id: post.id,
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
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            myVote: voteMap.get(post.id)?.value || 0,
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
              isVerifiedExpert,
              expertTitle: isVerifiedExpert ? "Verified Coach" : undefined,
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

  async getPostDetails(userId: string, postId: string, page = 1, limit = 30) {
    await ensureProfile(userId);

    const post = await prisma.communityPost.findFirst({
      where: { id: postId, isDeleted: false },
    });
    if (!post) {
      throw new Error("post not found");
    }

    await prisma.communityPost.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    });

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [answers, answerTotal, postAuthor, postAuthorProfile, myPostVote] =
      await Promise.all([
        prisma.communityAnswer.findMany({
          where: { postId: post.id, isDeleted: false },
          orderBy: [{ voteScore: "desc" }, { createdAt: "asc" }],
          skip,
          take: safeLimit,
        }),
        prisma.communityAnswer.count({
          where: { postId: post.id, isDeleted: false },
        }),
        prisma.user.findUnique({
          where: { id: post.authorId },
          select: { id: true, name: true, photoUrl: true, photoS3Key: true, role: true },
        }),
        prisma.communityProfile.findUnique({
          where: { userId: post.authorId },
          select: { userId: true, anonymousAlias: true, isIdentityPublic: true },
        }),
        prisma.communityVote.findFirst({
          where: { userId, targetType: "POST", targetId: post.id },
          select: { value: true },
        }),
      ]);

    const answerAuthorIds = answers.map((item) => item.authorId);
    const answerIds = answers.map((item) => item.id);
    const [answerUsers, answerProfiles, answerVotes] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: answerAuthorIds } },
        select: { id: true, name: true, photoUrl: true, photoS3Key: true, role: true },
      }),
      prisma.communityProfile.findMany({
        where: { userId: { in: answerAuthorIds } },
        select: { userId: true, anonymousAlias: true, isIdentityPublic: true },
      }),
      prisma.communityVote.findMany({
        where: {
          userId,
          targetType: "ANSWER",
          targetId: { in: answerIds },
        },
        select: { targetId: true, value: true },
      }),
    ]);

    const answerUserMap = new Map(
      answerUsers.map((answerUser) => [answerUser.id, answerUser]),
    );
    const answerProfileMap = new Map(
      answerProfiles.map((answerProfile) => [
        answerProfile.userId,
        answerProfile,
      ]),
    );
    const answerVoteMap = new Map(
      answerVotes.map((answerVote) => [answerVote.targetId, answerVote]),
    );

    const postAuthorId = post.authorId;
    const isPostAuthorSelf = postAuthorId === userId;
    const isPostAnon = post.isAnonymous && !isPostAuthorSelf;
    const isPostAuthorExpert = !isPostAnon && postAuthor?.role === "Coach";

    return {
      post: {
        id: post.id,
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
          isVerifiedExpert: isPostAuthorExpert,
          expertTitle: isPostAuthorExpert ? "Verified Coach" : undefined,
        },
      },
      answers: await Promise.all(
        answers.map(async (answer) => {
          const answerAuthorId = answer.authorId;
          const answerUser = answerUserMap.get(answerAuthorId);
          const answerProfile = answerProfileMap.get(answerAuthorId);
          const isAnswerSelf = answerAuthorId === userId;
          const isAnswerAnon = answer.isAnonymous && !isAnswerSelf;
          const isAnswerExpert = !isAnswerAnon && answerUser?.role === "Coach";

          return {
            id: answer.id,
            postId: answer.postId,
            content: answer.content,
            isAnonymous: answer.isAnonymous || false,
            voteScore: answer.voteScore || 0,
            upvoteCount: answer.upvoteCount || 0,
            downvoteCount: answer.downvoteCount || 0,
            createdAt: answer.createdAt,
            updatedAt: answer.updatedAt,
            myVote: answerVoteMap.get(answer.id)?.value || 0,
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
              isVerifiedExpert: isAnswerExpert,
              expertTitle: isAnswerExpert ? "Verified Coach" : undefined,
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

    const post = await prisma.communityPost.create({
      data: {
        authorId: userId,
        title: payload.title.trim(),
        body: payload.body.trim(),
        tags: normalizeTags(payload.tags),
        sport: normalizeOptionalText(payload.sport),
        city: normalizeOptionalText(payload.city),
        ...(payload.category ? { category: payload.category } : {}),
        ...(payload.isAnonymous ? { isAnonymous: true } : {}),
      },
    });

    await prisma.communityReputation.upsert({
      where: { userId },
      create: {
        userId,
        totalPoints: COMMUNITY_POINTS.CREATE_POST,
        questionCount: 1,
        answerCount: 0,
        receivedUpvotes: 0,
      },
      update: {
        totalPoints: { increment: COMMUNITY_POINTS.CREATE_POST },
        questionCount: { increment: 1 },
      },
    });

    trackCommunityRoleMixEvent("qna_post_created", {
      userRole,
      userId,
      postId: post.id,
    });

    return {
      id: post.id,
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

    const post = await prisma.communityPost.findFirst({
      where: { id: postId, isDeleted: false },
    });
    if (!post) {
      throw new Error("post not found");
    }

    if (post.authorId !== userId) {
      throw new Error("Only the author can update this post");
    }

    const data: Prisma.CommunityPostUpdateInput = {};
    if (typeof payload.title === "string") {
      data.title = payload.title.trim();
    }
    if (typeof payload.body === "string") {
      data.body = payload.body.trim();
    }
    if (Array.isArray(payload.tags)) {
      data.tags = normalizeTags(payload.tags);
    }
    if (payload.status === "OPEN" || payload.status === "CLOSED") {
      data.status = payload.status;
    }
    if (typeof payload.sport === "string") {
      data.sport = normalizeOptionalText(payload.sport);
    }
    if (typeof payload.city === "string") {
      data.city = normalizeOptionalText(payload.city);
    }

    const updated = await prisma.communityPost.update({
      where: { id: post.id },
      data,
    });

    return {
      id: updated.id,
      title: updated.title,
      body: updated.body,
      tags: updated.tags,
      sport: updated.sport || "",
      city: updated.city || "",
      status: updated.status,
      voteScore: updated.voteScore,
      upvoteCount: updated.upvoteCount,
      downvoteCount: updated.downvoteCount,
      answerCount: updated.answerCount,
      viewCount: updated.viewCount,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },

  async deletePost(userId: string, postId: string) {
    await ensureProfile(userId);

    const post = await prisma.communityPost.findFirst({
      where: { id: postId, isDeleted: false },
    });
    if (!post) {
      throw new Error("post not found");
    }

    if (post.authorId !== userId) {
      throw new Error("Only the author can delete this post");
    }

    await prisma.communityPost.update({
      where: { id: post.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return { id: post.id, deleted: true };
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

    const post = await prisma.communityPost.findFirst({
      where: { id: postId, isDeleted: false },
    });
    if (!post) {
      throw new Error("post not found");
    }

    if (post.status !== "OPEN") {
      throw new Error("Cannot answer a closed post");
    }

    const answer = await prisma.communityAnswer.create({
      data: {
        postId: post.id,
        authorId: userId,
        content: content.trim(),
        ...(isAnonymous ? { isAnonymous: true } : {}),
      },
    });

    if (post.authorId !== userId) {
      NotificationService.send({
        userId: post.authorId,
        type: "MESSAGE_RECEIVED",
        title: "New answer on your question",
        message: "Someone shared a new answer on your community question.",
        data: {
          postId: post.id,
          answerId: answer.id,
          actorUserId: userId,
          event: "COMMUNITY_ANSWER_CREATED",
        },
      }).catch((error: unknown) => {
        console.error("Failed to send community answer notification:", error);
      });
    }

    await Promise.all([
      prisma.communityPost.update({
        where: { id: post.id },
        data: { answerCount: { increment: 1 } },
      }),
      prisma.communityReputation.upsert({
        where: { userId },
        create: {
          userId,
          totalPoints: COMMUNITY_POINTS.CREATE_ANSWER,
          answerCount: 1,
          questionCount: 0,
          receivedUpvotes: 0,
        },
        update: {
          totalPoints: { increment: COMMUNITY_POINTS.CREATE_ANSWER },
          answerCount: { increment: 1 },
        },
      }),
    ]);

    trackCommunityRoleMixEvent("qna_answer_created", {
      userRole,
      userId,
      postId: post.id,
      answerId: answer.id,
    });

    return {
      id: answer.id,
      postId: answer.postId,
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

    const answer = await prisma.communityAnswer.findFirst({
      where: { id: answerId, isDeleted: false },
    });
    if (!answer) {
      throw new Error("answer not found");
    }

    if (answer.authorId !== userId) {
      throw new Error("Only the author can update this answer");
    }

    const updated = await prisma.communityAnswer.update({
      where: { id: answer.id },
      data: { content: content.trim() },
    });

    return {
      id: updated.id,
      postId: updated.postId,
      content: updated.content,
      voteScore: updated.voteScore,
      upvoteCount: updated.upvoteCount,
      downvoteCount: updated.downvoteCount,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },

  async deleteAnswer(userId: string, answerId: string) {
    await ensureProfile(userId);

    const answer = await prisma.communityAnswer.findFirst({
      where: { id: answerId, isDeleted: false },
    });
    if (!answer) {
      throw new Error("answer not found");
    }

    if (answer.authorId !== userId) {
      throw new Error("Only the author can delete this answer");
    }

    await prisma.communityAnswer.update({
      where: { id: answer.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await prisma.communityPost.updateMany({
      where: { id: answer.postId, answerCount: { gt: 0 } },
      data: { answerCount: { decrement: 1 } },
    });

    return {
      id: answer.id,
      postId: answer.postId,
      deleted: true,
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

    let targetAuthorId = "";

    if (payload.targetType === "POST") {
      const post = await prisma.communityPost.findFirst({
        where: { id: payload.targetId, isDeleted: false },
        select: { id: true, authorId: true },
      });
      if (!post) {
        throw new Error("post not found");
      }
      targetAuthorId = post.authorId;
    } else {
      const answer = await prisma.communityAnswer.findFirst({
        where: { id: payload.targetId, isDeleted: false },
        select: { id: true, authorId: true },
      });
      if (!answer) {
        throw new Error("answer not found");
      }
      targetAuthorId = answer.authorId;
    }

    if (targetAuthorId === userId) {
      throw new Error("You cannot vote on your own content");
    }

    const existingVote = await prisma.communityVote.findFirst({
      where: {
        userId,
        targetType: payload.targetType,
        targetId: payload.targetId,
      },
    });

    const previousValue = (existingVote?.value as 1 | -1 | undefined) || null;
    const nextValue = previousValue === payload.value ? null : payload.value;
    const deltas = getVoteTransitionDeltas(previousValue, nextValue);

    await prisma.$transaction(async (tx) => {
      if (nextValue === null) {
        if (existingVote?.id) {
          await tx.communityVote.delete({ where: { id: existingVote.id } });
        }
      } else {
        await tx.communityVote.upsert({
          where: {
            userId_targetType_targetId: {
              userId,
              targetType: payload.targetType,
              targetId: payload.targetId,
            },
          },
          create: {
            userId,
            targetType: payload.targetType,
            targetId: payload.targetId,
            value: nextValue,
          },
          update: { value: nextValue },
        });
      }

      if (payload.targetType === "POST") {
        await tx.communityPost.update({
          where: { id: payload.targetId },
          data: {
            voteScore: { increment: deltas.voteScore },
            upvoteCount: { increment: deltas.upvoteCount },
            downvoteCount: { increment: deltas.downvoteCount },
          },
        });
      } else {
        await tx.communityAnswer.update({
          where: { id: payload.targetId },
          data: {
            voteScore: { increment: deltas.voteScore },
            upvoteCount: { increment: deltas.upvoteCount },
            downvoteCount: { increment: deltas.downvoteCount },
          },
        });
      }

      if (deltas.upvoteCount !== 0) {
        await tx.communityReputation.upsert({
          where: { userId: targetAuthorId },
          create: {
            userId: targetAuthorId,
            totalPoints: deltas.upvoteCount * COMMUNITY_POINTS.RECEIVE_UPVOTE,
            receivedUpvotes: deltas.upvoteCount,
            questionCount: 0,
            answerCount: 0,
          },
          update: {
            totalPoints: {
              increment: deltas.upvoteCount * COMMUNITY_POINTS.RECEIVE_UPVOTE,
            },
            receivedUpvotes: { increment: deltas.upvoteCount },
          },
        });
      }
    });

    const updatedTarget =
      payload.targetType === "POST"
        ? await prisma.communityPost.findUnique({
            where: { id: payload.targetId },
            select: { voteScore: true, upvoteCount: true, downvoteCount: true },
          })
        : await prisma.communityAnswer.findUnique({
            where: { id: payload.targetId },
            select: {
              voteScore: true,
              upvoteCount: true,
              downvoteCount: true,
              postId: true,
            },
          });

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
              ? (updatedTarget as { postId?: string })?.postId || ""
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
          ? (updatedTarget as { postId?: string })?.postId || ""
          : payload.targetId,
    };
  },

  async searchPlayers(
    userId: string,
    query: string,
    limit = 10,
    userTypeFilter?: string,
    roleFilter?: string,
  ) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery && !userTypeFilter && !roleFilter) {
      return [];
    }

    const safeLimit = Math.min(20, Math.max(1, limit));
    const profile = await ensureProfile(userId);

    const userWhere: any = {
      id: { not: userId },
      role: roleFilter ? roleFilter : { in: [...COMMUNITY_ALLOWED_ROLES] },
    };
    if (userTypeFilter) {
      userWhere.userType = userTypeFilter;
    }
    if (normalizedQuery) {
      userWhere.name = { contains: normalizedQuery, mode: "insensitive" };
    }

    const profileWhere: any = { userId: { not: userId } };
    if (normalizedQuery) {
      profileWhere.anonymousAlias = {
        contains: normalizedQuery,
        mode: "insensitive",
      };
    }

    const [nameMatches, aliasMatches] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: { id: true, name: true, photoUrl: true, photoS3Key: true },
        take: safeLimit * 3,
      }),
      normalizedQuery
        ? prisma.communityProfile.findMany({
            where: profileWhere,
            select: { userId: true },
            take: safeLimit * 3,
          })
        : Promise.resolve([] as { userId: string }[]),
    ]);

    const candidateIds = new Set<string>();
    for (const user of nameMatches) {
      candidateIds.add(user.id);
    }
    for (const match of aliasMatches) {
      candidateIds.add(match.userId);
    }

    const ids = Array.from(candidateIds);
    if (!ids.length) {
      return [];
    }

    const [users, profiles] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids }, role: { in: [...COMMUNITY_ALLOWED_ROLES] } },
        select: {
          id: true,
          name: true,
          photoUrl: true,
          photoS3Key: true,
          role: true,
          userType: true,
          city: true,
          dob: true,
        },
      }),
      prisma.communityProfile.findMany({
        where: { userId: { in: ids } },
        select: {
          userId: true,
          anonymousAlias: true,
          isIdentityPublic: true,
          blockedUsers: { select: { blockedUserId: true } },
        },
      }),
    ]);

    const blockedByMe = new Set(
      profile.blockedUsers.map((blocked) => blocked.blockedUserId),
    );
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const items = await Promise.all(
      users
        .filter((user) => {
          const candidateId = user.id;
          if (blockedByMe.has(candidateId)) {
            return false;
          }

          const candidateProfile = profileMap.get(candidateId);
          const blockedMe = Boolean(
            candidateProfile?.blockedUsers?.some(
              (blocked) => blocked.blockedUserId === userId,
            ),
          );

          return !blockedMe;
        })
        .map((user) => {
          const candidateId = user.id;
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
            userType: (user as any).userType || "Player",
            photoUrl: null as string | null,
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
                users.find((user) => user.id === item.id),
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
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          name: true,
          photoUrl: true,
          photoS3Key: true,
          role: true,
          userType: true,
          dob: true,
          city: true,
          createdAt: true,
          lastActiveAt: true,
        },
      }),
      prisma.communityProfile.findUnique({
        where: { userId: targetUserId },
        select: {
          userId: true,
          anonymousAlias: true,
          isIdentityPublic: true,
          messagePrivacy: true,
          readReceiptsEnabled: true,
          lastSeenVisible: true,
          lastSeenAt: true,
          blockedUsers: { select: { blockedUserId: true } },
        },
      }),
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
        (blocked) => blocked.blockedUserId === viewerId,
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
      lastSeenAt: undefined as Date | null | undefined,
    };
    const isSelf = targetUserId === viewerId;
    const isIdentityPublic = isSelf || Boolean(profile.isIdentityPublic);

    return {
      id: targetUser.id,
      role: targetUser.role,
      userType: (targetUser as any).userType || "Player",
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
    return serializeProfile(profile);
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
    await ensureProfile(userId);

    const data: Prisma.CommunityProfileUpdateInput = {};

    if (typeof payload.isIdentityPublic === "boolean") {
      data.isIdentityPublic = payload.isIdentityPublic;
    }

    if (payload.messagePrivacy) {
      data.messagePrivacy = payload.messagePrivacy;
    }

    if (typeof payload.readReceiptsEnabled === "boolean") {
      data.readReceiptsEnabled = payload.readReceiptsEnabled;
    }

    if (typeof payload.lastSeenVisible === "boolean") {
      data.lastSeenVisible = payload.lastSeenVisible;
    }

    if (payload.anonymousAlias?.trim()) {
      data.anonymousAlias = payload.anonymousAlias.trim();
    }

    const updated = await prisma.communityProfile.update({
      where: { userId },
      data,
      include: { blockedUsers: true },
    });

    return serializeProfile(updated);
  },

  async blockUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new Error("You cannot block yourself");
    }

    const [profile] = await Promise.all([
      ensureProfile(userId),
      ensureCommunityUser(targetUserId),
    ]);

    await prisma.communityBlockedUser.upsert({
      where: {
        profileId_blockedUserId: {
          profileId: profile.id,
          blockedUserId: targetUserId,
        },
      },
      create: { profileId: profile.id, blockedUserId: targetUserId },
      update: {},
    });

    return { blockedUserId: targetUserId };
  },

  async unblockUser(userId: string, targetUserId: string) {
    const profile = await ensureProfile(userId);

    await prisma.communityBlockedUser.deleteMany({
      where: { profileId: profile.id, blockedUserId: targetUserId },
    });

    return { unblockedUserId: targetUserId };
  },

  async getBlockedUsers(userId: string) {
    const profile = await ensureProfile(userId);
    const blockedIds = profile.blockedUsers.map((blocked) => blocked.blockedUserId);
    const users = await prisma.user.findMany({
      where: { id: { in: blockedIds } },
      select: { id: true, name: true, photoUrl: true, photoS3Key: true },
    });

    return Promise.all(
      users.map(async (user) => ({
        id: user.id,
        name: user.name,
        photoUrl: await resolveUserPhotoUrl(user),
      })),
    );
  },

  async listGroups(userId: string, query = "", limit = 20) {
    await ensureProfile(userId);

    const normalizedQuery = query.trim();
    const safeLimit = Math.min(50, Math.max(1, limit));

    const where: Prisma.CommunityGroupWhereInput = { visibility: "PUBLIC" };
    if (normalizedQuery) {
      where.OR = [
        { name: { contains: normalizedQuery, mode: "insensitive" } },
        { sport: { contains: normalizedQuery, mode: "insensitive" } },
        { city: { contains: normalizedQuery, mode: "insensitive" } },
      ];
    }

    const groups = await prisma.communityGroup.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: safeLimit,
      include: { members: true },
    });

    return groups.map((group) => {
      const memberIds = group.members.map((member) => member.userId);
      const adminIds = group.members
        .filter((member) => member.role === "ADMIN")
        .map((member) => member.userId);
      return {
        id: group.id,
        name: group.name,
        description: group.description || "",
        visibility: group.visibility,
        audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
        sport: group.sport || "",
        city: group.city || "",
        createdBy: group.createdBy,
        memberCount: memberIds.length,
        isMember: memberIds.includes(userId),
        isAdmin: adminIds.includes(userId),
        memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
      };
    });
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
    },
  ) {
    await ensureProfile(userId);

    const creatorRole = await getCommunityRole(userId);

    const name = payload.name.trim();
    if (!name) {
      throw new Error("Group name is required");
    }

    // Mongo upsert-by-(createdBy,name) had no unique constraint; emulate the
    // idempotency with a find-then-create. Creator is stored once in the merged
    // members table with role ADMIN (was members[] + admins[]).
    const existingGroup = await prisma.communityGroup.findFirst({
      where: { createdBy: userId, name },
      include: { members: true },
    });

    const group =
      existingGroup ??
      (await prisma.communityGroup.create({
        data: {
          name,
          description: normalizeOptionalText(payload.description),
          sport: payload.sport || "",
          city: payload.city || "",
          profilePicture: payload.profilePicture || "",
          profilePictureKey: payload.profilePictureKey || "",
          visibility: "PUBLIC",
          memberAddPolicy: "ADMIN_ONLY",
          audience: payload.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
          createdBy: userId,
          inviteCode: generateInviteCode(),
          members: { create: [{ userId, role: "ADMIN" }] },
        },
        include: { members: true },
      }));

    trackCommunityRoleMixEvent("group_created", {
      groupId: group.id,
      createdByRole: creatorRole,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
    });

    let conversation = await prisma.communityConversation.findFirst({
      where: { conversationType: "GROUP", groupId: group.id },
    });
    if (!conversation) {
      conversation = await prisma.communityConversation.create({
        data: {
          conversationType: "GROUP",
          groupId: group.id,
          participantKey: buildGroupParticipantKey(group.id),
          status: "ACTIVE",
          requestedBy: userId,
          lastMessageAt: new Date(),
          participants: { create: [{ userId }] },
        },
      });
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description || "",
      visibility: group.visibility,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
      sport: group.sport || "",
      city: group.city || "",
      profilePicture: group.profilePicture || "",
      memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
      memberCount: group.members.length,
      conversationId: conversation.id,
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
    },
  ) {
    await ensureProfile(userId);

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) {
      throw new Error("Group not found");
    }

    const requesterIsAdmin = group.members.some(
      (member) => member.role === "ADMIN" && member.userId === userId,
    );
    if (!requesterIsAdmin) {
      throw new Error("Only group admins can update the group");
    }

    const data: Prisma.CommunityGroupUpdateInput = {};
    if (payload.name) data.name = payload.name;
    if (typeof payload.description === "string") data.description = payload.description;
    if (typeof payload.sport === "string") data.sport = payload.sport;
    if (typeof payload.city === "string") data.city = payload.city;
    if (typeof payload.profilePicture === "string") data.profilePicture = payload.profilePicture;
    if (typeof payload.profilePictureKey === "string") data.profilePictureKey = payload.profilePictureKey;
    if (payload.audience) data.audience = payload.audience;

    const updated = await prisma.communityGroup.update({
      where: { id: group.id },
      data,
    });

    return {
      groupId: updated.id,
      name: updated.name,
      description: updated.description,
      sport: updated.sport,
      city: updated.city,
      audience: updated.audience,
    };
  },

  async updateGroupSettings(
    userId: string,
    groupId: string,
    payload: { memberAddPolicy: "ADMIN_ONLY" | "ANY_MEMBER" },
  ) {
    await ensureProfile(userId);

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) {
      throw new Error("Group not found");
    }

    const requesterIsAdmin = group.members.some(
      (member) => member.role === "ADMIN" && member.userId === userId,
    );
    if (!requesterIsAdmin) {
      throw new Error("Only group admins can update settings");
    }

    const updated = await prisma.communityGroup.update({
      where: { id: group.id },
      data: { memberAddPolicy: payload.memberAddPolicy },
    });

    return {
      groupId: updated.id,
      memberAddPolicy: updated.memberAddPolicy,
    };
  },

  async joinGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const userRole = await getCommunityRole(userId);

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) {
      throw new Error("Group not found");
    }

    const groupAudience =
      (group.audience as CommunityGroupAudience | undefined) ||
      COMMUNITY_DEFAULT_GROUP_AUDIENCE;
    if (!canJoinGroupAudience(groupAudience, userRole)) {
      throw new Error("This group is not available for your role");
    }

    const alreadyMember = group.members.some(
      (member) => member.userId === userId,
    );
    if (!alreadyMember) {
      await prisma.communityGroupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId } },
        create: { groupId: group.id, userId, role: "MEMBER" },
        update: {},
      });

      trackCommunityRoleMixEvent("group_joined", {
        groupId,
        audience: groupAudience,
        role: userRole,
      });
    }

    let conversation = await prisma.communityConversation.findFirst({
      where: { conversationType: "GROUP", groupId: group.id },
    });
    if (!conversation) {
      conversation = await prisma.communityConversation.create({
        data: {
          conversationType: "GROUP",
          groupId: group.id,
          participantKey: buildGroupParticipantKey(group.id),
          status: "ACTIVE",
          requestedBy: group.createdBy,
          lastMessageAt: new Date(),
          participants: { create: [{ userId }] },
        },
      });
    } else {
      await prisma.conversationParticipant.upsert({
        where: {
          conversationId_userId: { conversationId: conversation.id, userId },
        },
        create: { conversationId: conversation.id, userId },
        update: {},
      });
    }

    if (!alreadyMember) {
      const adminIds = group.members
        .filter((member) => member.role === "ADMIN")
        .map((member) => member.userId)
        .filter((adminId) => adminId !== userId);

      for (const adminId of adminIds) {
        sendCommunityNotification(
          adminId,
          "New group member",
          `A new member joined ${group.name}.`,
          {
            event: "COMMUNITY_GROUP_JOINED",
            groupId: group.id,
            conversationId: conversation?.id || "",
            actorUserId: userId,
          },
        );
      }
    }

    return {
      groupId: group.id,
      conversationId: conversation?.id || "",
      memberCount: group.members.length + (alreadyMember ? 0 : 1),
    };
  },

  async deleteGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) {
      throw new Error("Group not found");
    }

    const isCreator = group.createdBy === userId;
    const isAdmin = group.members.some(
      (member) => member.role === "ADMIN" && member.userId === userId,
    );

    if (!isCreator && !isAdmin) {
      throw new Error("Only group admins can delete the group");
    }

    const groupConversation = await prisma.communityConversation.findFirst({
      where: { conversationType: "GROUP", groupId: group.id },
    });

    if (groupConversation) {
      await prisma.$transaction([
        prisma.communityMessage.deleteMany({
          where: { conversationId: groupConversation.id },
        }),
        prisma.communityConversation.delete({
          where: { id: groupConversation.id },
        }),
      ]);
    }

    await prisma.communityGroup.delete({ where: { id: group.id } });

    return { groupId: group.id, deletedGroup: true };
  },

  async leaveGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) {
      throw new Error("Group not found");
    }

    const wasMember = group.members.some(
      (member) => member.userId === userId,
    );
    if (!wasMember) {
      return { groupId, removed: false };
    }

    // Removing the merged member row drops both membership and admin role.
    await prisma.communityGroupMember.deleteMany({
      where: { groupId: group.id, userId },
    });

    const remainingMembers = group.members.filter(
      (member) => member.userId !== userId,
    );

    let promotedAdminId: string | null = null;
    const hasAdmin = remainingMembers.some(
      (member) => member.role === "ADMIN",
    );
    if (!hasAdmin && remainingMembers.length) {
      const fallbackAdmin = remainingMembers[0];
      if (fallbackAdmin) {
        await prisma.communityGroupMember.update({
          where: {
            groupId_userId: { groupId: group.id, userId: fallbackAdmin.userId },
          },
          data: { role: "ADMIN" },
        });
        promotedAdminId = fallbackAdmin.userId;
      }
    }

    const groupConversation = await prisma.communityConversation.findFirst({
      where: { conversationType: "GROUP", groupId: group.id },
      include: { participants: true },
    });

    if (groupConversation) {
      await prisma.conversationParticipant.deleteMany({
        where: { conversationId: groupConversation.id, userId },
      });

      const remainingParticipants = groupConversation.participants.filter(
        (participant) => participant.userId !== userId,
      );

      if (!remainingParticipants.length || !remainingMembers.length) {
        await prisma.$transaction([
          prisma.communityMessage.deleteMany({
            where: { conversationId: groupConversation.id },
          }),
          prisma.communityConversation.delete({
            where: { id: groupConversation.id },
          }),
        ]);
      }
    }

    if (!remainingMembers.length) {
      await prisma.communityGroup.delete({ where: { id: group.id } });
      return { groupId: group.id, removed: true, deletedGroup: true };
    }

    const remainingAdminIds = new Set(
      remainingMembers
        .filter((member) => member.role === "ADMIN")
        .map((member) => member.userId),
    );
    if (promotedAdminId) {
      remainingAdminIds.add(promotedAdminId);
    }

    for (const adminId of remainingAdminIds) {
      if (adminId === userId) {
        continue;
      }
      sendCommunityNotification(
        adminId,
        "Member left group",
        `A member left ${group.name}.`,
        {
          event: "COMMUNITY_GROUP_LEFT",
          groupId: group.id,
          actorUserId: userId,
        },
      );
    }

    return { groupId: group.id, removed: true, deletedGroup: false };
  },

  async addGroupMember(userId: string, groupId: string, targetUserId: string) {
    await Promise.all([
      ensureProfile(userId),
      ensureCommunityUser(targetUserId),
    ]);

    if (userId === targetUserId) {
      throw new Error("Use join group to add yourself");
    }

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
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

    const requesterIsAdmin = group.members.some(
      (member) => member.role === "ADMIN" && member.userId === userId,
    );
    const requesterIsMember = group.members.some(
      (member) => member.userId === userId,
    );
    if (!requesterIsMember) {
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

    const alreadyMember = group.members.some(
      (member) => member.userId === targetUserId,
    );
    if (!alreadyMember) {
      await prisma.communityGroupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: targetUserId } },
        create: { groupId: group.id, userId: targetUserId, role: "MEMBER" },
        update: {},
      });
    }

    let conversation = await prisma.communityConversation.findFirst({
      where: { conversationType: "GROUP", groupId: group.id },
    });
    if (!conversation) {
      conversation = await prisma.communityConversation.create({
        data: {
          conversationType: "GROUP",
          groupId: group.id,
          participantKey: buildGroupParticipantKey(group.id),
          status: "ACTIVE",
          requestedBy: group.createdBy,
          lastMessageAt: new Date(),
          participants: { create: [{ userId: targetUserId }] },
        },
      });
    } else {
      await prisma.conversationParticipant.upsert({
        where: {
          conversationId_userId: {
            conversationId: conversation.id,
            userId: targetUserId,
          },
        },
        create: { conversationId: conversation.id, userId: targetUserId },
        update: {},
      });
    }

    if (!alreadyMember && targetUserId !== userId) {
      sendCommunityNotification(
        targetUserId,
        "You were added to a group",
        `${group.name} added you to the community discussion.`,
        {
          event: "COMMUNITY_GROUP_MEMBER_ADDED",
          groupId: group.id,
          conversationId: conversation?.id || "",
          actorUserId: userId,
        },
      );
    }

    return {
      groupId: group.id,
      conversationId: conversation?.id || "",
      memberCount: group.members.length + (alreadyMember ? 0 : 1),
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
    const existingConversation = await prisma.communityConversation.findFirst({
      where: { participantKey },
    });
    if (existingConversation) {
      return {
        id: existingConversation.id,
        status: existingConversation.status,
        requestedBy: existingConversation.requestedBy,
        myAlias: meProfile.anonymousAlias,
      };
    }

    const initialStatus =
      targetProfile.messagePrivacy === "REQUEST_ONLY" ? "PENDING" : "ACTIVE";

    const conversation = await prisma.communityConversation.create({
      data: {
        conversationType: "DM",
        participantKey,
        status: initialStatus,
        requestedBy: userId,
        lastMessageAt: new Date(),
        participants: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
    });

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
          conversationId: conversation.id,
          actorUserId: userId,
        },
      );
    }

    return {
      id: conversation.id,
      status: conversation.status,
      requestedBy: conversation.requestedBy,
      myAlias: meProfile.anonymousAlias,
    };
  },

  async acceptConversationRequest(userId: string, conversationId: string) {
    const conversation = await prisma.communityConversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.conversationType === "GROUP") {
      throw new Error("Group conversations do not require acceptance");
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.userId === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    let status = conversation.status;

    if (conversation.status === "PENDING") {
      const requester = conversation.requestedBy;
      if (requester === userId) {
        throw new Error("Requester cannot accept own request");
      }
      const updated = await prisma.communityConversation.update({
        where: { id: conversation.id },
        data: { status: "ACTIVE" },
      });
      status = updated.status;

      sendCommunityNotification(
        requester,
        "Message request accepted",
        "Your community conversation request was accepted.",
        {
          event: "COMMUNITY_CONVERSATION_ACCEPTED",
          conversationId: conversation.id,
          actorUserId: userId,
        },
      );
    }

    return { id: conversation.id, status };
  },

  async rejectConversationRequest(userId: string, conversationId: string) {
    const conversation = await prisma.communityConversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.conversationType === "GROUP") {
      throw new Error("Group conversations do not support rejection");
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.userId === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const requester = conversation.requestedBy;
    if (requester === userId) {
      throw new Error("Requester cannot reject own request");
    }

    sendCommunityNotification(
      requester,
      "Message request declined",
      "Your community conversation request was declined.",
      {
        event: "COMMUNITY_CONVERSATION_REJECTED",
        conversationId: conversation.id,
        actorUserId: userId,
      },
    );

    await prisma.$transaction([
      prisma.communityMessage.deleteMany({
        where: { conversationId: conversation.id },
      }),
      prisma.communityConversation.delete({ where: { id: conversation.id } }),
    ]);

    return { rejected: true };
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

    const conversationWhere: Prisma.CommunityConversationWhereInput = {
      participants: { some: { userId } },
    };
    if (type === "GROUPS") {
      conversationWhere.conversationType = "GROUP";
    } else if (type === "CONTACTS") {
      conversationWhere.conversationType = { not: "GROUP" };
    }

    let total = 0;
    let conversations: (CommunityConversationRow & {
      participants: { userId: string }[];
    })[] = [];

    if (requiresInMemoryFiltering) {
      conversations = await prisma.communityConversation.findMany({
        where: conversationWhere,
        orderBy: { updatedAt: "desc" },
        include: { participants: { select: { userId: true } } },
      });
      total = conversations.length;
    } else {
      total = await prisma.communityConversation.count({
        where: conversationWhere,
      });
      conversations = await prisma.communityConversation.findMany({
        where: conversationWhere,
        orderBy: { updatedAt: "desc" },
        skip,
        take: safeLimit,
        include: { participants: { select: { userId: true } } },
      });
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

    const conversationIds = conversations.map((conversation) => conversation.id);

    const dmConversations = conversations.filter(
      (conversation) => conversation.conversationType !== "GROUP",
    );

    const otherParticipantIds = dmConversations.map((conversation) => {
      const other = conversation.participants.find(
        (participant) => participant.userId !== userId,
      );
      return other?.userId || "";
    });

    const groupConversationIds = conversations
      .filter((conversation) => conversation.conversationType === "GROUP")
      .map((conversation) => conversation.groupId || "")
      .filter(Boolean);

    const [users, profiles, latestMessages, unreadStats, groups] =
      await Promise.all([
        prisma.user.findMany({
          where: { id: { in: otherParticipantIds } },
          select: { id: true, name: true, photoUrl: true, photoS3Key: true },
        }),
        prisma.communityProfile.findMany({
          where: { userId: { in: otherParticipantIds } },
          select: {
            userId: true,
            anonymousAlias: true,
            isIdentityPublic: true,
            lastSeenVisible: true,
            lastSeenAt: true,
          },
        }),
        // Latest message per conversation (was a Mongo $group $first pipeline).
        Promise.all(
          conversationIds.map((conversationId) =>
            prisma.communityMessage.findFirst({
              where: { conversationId },
              orderBy: { createdAt: "desc" },
              select: {
                conversationId: true,
                content: true,
                createdAt: true,
                senderId: true,
                type: true,
                isDeleted: true,
              },
            }),
          ),
        ),
        // Unread count per conversation (was a Mongo $match/$group pipeline).
        Promise.all(
          conversationIds.map(async (conversationId) => ({
            conversationId,
            unreadCount: await prisma.communityMessage.count({
              where: {
                conversationId,
                senderId: { not: userId },
                readBy: { none: { userId } },
              },
            }),
          })),
        ),
        prisma.communityGroup.findMany({
          where: { id: { in: groupConversationIds } },
          select: {
            id: true,
            name: true,
            description: true,
            visibility: true,
            sport: true,
            city: true,
            _count: { select: { members: true } },
          },
        }),
      ]);

    const userMap = new Map(users.map((user) => [user.id, user]));
    const profileMap = new Map(
      profiles.map((profile) => [profile.userId, profile]),
    );
    const messageMap = new Map(
      latestMessages
        .filter((message): message is NonNullable<typeof message> =>
          Boolean(message),
        )
        .map((message) => [message.conversationId, message]),
    );
    const unreadMap = new Map(
      unreadStats.map((item) => [item.conversationId, item.unreadCount || 0]),
    );
    const groupMap = new Map(groups.map((group) => [group.id, group]));

    const mappedItems = await Promise.all(
      conversations.map(async (conversation) => {
        const conversationType = conversation.conversationType || "DM";
        const otherId =
          conversation.participants.find(
            (participant) => participant.userId !== userId,
          )?.userId || "";
        const otherUser = userMap.get(otherId);
        const otherProfile = profileMap.get(otherId);
        const latest = messageMap.get(conversation.id);
        const group = conversation.groupId
          ? groupMap.get(conversation.groupId)
          : null;
        const groupMemberCount = group?._count?.members || 0;

        return {
          id: conversation.id,
          conversationType,
          status: conversation.status,
          requestedBy: conversation.requestedBy,
          otherParticipant: {
            id: conversationType === "GROUP" ? group?.id || "" : otherId,
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
                  id: group?.id || "",
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
                senderId: latest.senderId,
                type: latest.type || "TEXT",
              }
            : null,
          unreadCount: unreadMap.get(conversation.id) || 0,
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
    const conversations = await prisma.communityConversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: "desc" },
      take: safeLimit,
      select: { id: true },
    });

    return conversations.map((conversation) => conversation.id);
  },

  async markConversationRead(userId: string, conversationId: string) {
    const conversation = await prisma.communityConversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.userId === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const unreadMessages = await prisma.communityMessage.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readBy: { none: { userId } },
      },
      select: { id: true },
    });

    if (!unreadMessages.length) {
      return {
        conversationId: conversation.id,
        participantIds: conversation.participants.map(
          (participant) => participant.userId,
        ),
        readerId: userId,
        messageIds: [] as string[],
      };
    }

    await prisma.messageReadReceipt.createMany({
      data: unreadMessages.map((message) => ({
        messageId: message.id,
        userId,
      })),
      skipDuplicates: true,
    });

    return {
      conversationId: conversation.id,
      participantIds: conversation.participants.map(
        (participant) => participant.userId,
      ),
      readerId: userId,
      messageIds: unreadMessages.map((message) => message.id),
    };
  },

  async markConversationDelivered(userId: string, conversationId: string) {
    const conversation = await prisma.communityConversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.userId === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const undeliveredMessages = await prisma.communityMessage.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        deliveredTo: { none: { userId } },
      },
      select: { id: true },
    });

    if (!undeliveredMessages.length) {
      return {
        conversationId: conversation.id,
        participantIds: conversation.participants.map(
          (participant) => participant.userId,
        ),
        readerId: userId,
        messageIds: [] as string[],
      };
    }

    await prisma.messageDeliveryReceipt.createMany({
      data: undeliveredMessages.map((message) => ({
        messageId: message.id,
        userId,
      })),
      skipDuplicates: true,
    });

    return {
      conversationId: conversation.id,
      participantIds: conversation.participants.map(
        (participant) => participant.userId,
      ),
      readerId: userId,
      messageIds: undeliveredMessages.map((message) => message.id),
    };
  },

  async getMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 30,
  ) {
    const conversation = await prisma.communityConversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.userId === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const [messages, total] = await Promise.all([
      prisma.communityMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { readBy: { select: { userId: true } } },
      }),
      prisma.communityMessage.count({ where: { conversationId } }),
    ]);

    const allParticipantIds = conversation.participants.map(
      (participant) => participant.userId,
    );
    const users = await prisma.user.findMany({
      where: { id: { in: allParticipantIds } },
      select: { id: true, name: true, photoUrl: true, photoS3Key: true },
    });
    const profiles = await prisma.communityProfile.findMany({
      where: { userId: { in: allParticipantIds } },
      select: {
        userId: true,
        anonymousAlias: true,
        isIdentityPublic: true,
        readReceiptsEnabled: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));
    const profileMap = new Map(
      profiles.map((profile) => [profile.userId, profile]),
    );

    const messageItems = messages.reverse().map((message) => {
      const senderId = message.senderId;
      const sender = userMap.get(senderId);
      const senderProfile = profileMap.get(senderId);
      const isSelf = senderId === userId;
      const readBy = (message.readBy || [])
        .map((receipt) => receipt.userId)
        .filter((readerId) => {
          if (readerId === userId) {
            return true;
          }

          const readerProfile = profileMap.get(readerId);
          return readerProfile?.readReceiptsEnabled !== false;
        });

      return {
        id: message.id,
        conversationId: message.conversationId,
        conversationType: conversation.conversationType || "DM",
        senderId,
        type: message.type || "TEXT",
        senderDisplayName: isSelf
          ? sender?.name || "Me"
          : senderProfile?.isIdentityPublic
            ? sender?.name || "Player"
            : senderProfile?.anonymousAlias || "Anonymous Player",
        content: message.isDeleted ? "Message deleted" : message.content,
        metadata: buildMessageMetadata(message),
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
        ? await prisma.communityGroup.findUnique({
            where: { id: conversation.groupId },
            select: {
              id: true,
              name: true,
              description: true,
              visibility: true,
              sport: true,
              city: true,
              _count: { select: { members: true } },
            },
          })
        : null;

    return {
      conversation: {
        id: conversation.id,
        conversationType,
        status: conversation.status,
        requestedBy: conversation.requestedBy,
        group:
          conversationType === "GROUP"
            ? {
                id: group?.id || "",
                name: group?.name || "Community Group",
                description: group?.description || "",
                visibility: group?.visibility || "PUBLIC",
                sport: group?.sport || "",
                city: group?.city || "",
                memberCount: group?._count?.members || 0,
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
    },
  ) {
    const conversation = await prisma.communityConversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.userId === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    if (conversation.conversationType !== "GROUP") {
      const otherParticipantId =
        conversation.participants.find(
          (participant) => participant.userId !== userId,
        )?.userId || "";

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
      const requester = conversation.requestedBy;
      if (requester !== userId) {
        throw new Error("Please accept this message request first");
      }
    }

    const messageType = options?.type || "TEXT";
    const message = await prisma.communityMessage.create({
      data: {
        conversationId,
        senderId: userId,
        type: messageType,
        content: messageType === "TEXT" ? content.trim() : content,
        ...(messageType === "IMAGE" && options?.metadata
          ? {
              metaWidth: options.metadata.width ?? null,
              metaHeight: options.metadata.height ?? null,
            }
          : {}),
        readBy: { create: [{ userId }] },
      },
    });

    await prisma.communityConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    const participantIds = conversation.participants.map(
      (participant) => participant.userId,
    );
    const participants = await prisma.user.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, name: true, photoUrl: true, photoS3Key: true },
    });
    const profiles = await prisma.communityProfile.findMany({
      where: { userId: { in: participantIds } },
      select: { userId: true, anonymousAlias: true, isIdentityPublic: true },
    });

    const sender = participants.find(
      (participant) => participant.id === userId,
    );
    const senderProfile = profiles.find(
      (profile) => profile.userId === userId,
    );

    const senderDisplayName = senderProfile?.isIdentityPublic
      ? sender?.name || "Player"
      : senderProfile?.anonymousAlias || "Anonymous Player";

    const otherParticipantIds = participantIds.filter(
      (participantId) => participantId !== userId,
    );

    // Enqueue a single outbox delivery job to handle multi-channel fanout
    try {
      await prisma.outboxMessage.create({
        data: {
          type: "deliver_message",
          payload: {
            conversationId: conversation.id,
            messageId: message.id,
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
        },
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
            conversationId: conversation.id,
            messageId: message.id,
            actorUserId: userId,
            conversationType: conversation.conversationType || "DM",
          },
        );
      }
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      conversationType: conversation.conversationType || "DM",
      senderId: message.senderId,
      type: message.type || "TEXT",
      senderDisplayName,
      content: message.content,
      metadata: buildMessageMetadata(message),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      editedAt: null,
      isEdited: false,
      isDeleted: false,
      readBy: [message.senderId],
      participantIds,
    };
  },

  async editMessage(userId: string, messageId: string, content: string) {
    const message = await prisma.communityMessage.findUnique({
      where: { id: messageId },
      include: { readBy: { select: { userId: true } } },
    });
    if (!message) {
      throw new Error("Message not found");
    }

    const senderId = message.senderId;
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

    const updated = await prisma.communityMessage.update({
      where: { id: message.id },
      data: { content: trimmedContent, editedAt: new Date() },
    });

    const conversation = await prisma.communityConversation.findUnique({
      where: { id: message.conversationId },
      select: {
        conversationType: true,
        participants: { select: { userId: true } },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participants = conversation.participants.map(
      (participant) => participant.userId,
    );

    return {
      id: updated.id,
      conversationId: updated.conversationId,
      conversationType: conversation.conversationType || "DM",
      senderId,
      type: updated.type || "TEXT",
      content: updated.content,
      metadata: buildMessageMetadata(updated),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      editedAt: updated.editedAt,
      isEdited: true,
      isDeleted: false,
      readBy: (message.readBy || []).map((receipt) => receipt.userId),
      participantIds: participants,
    };
  },

  async deleteMessage(userId: string, messageId: string) {
    const message = await prisma.communityMessage.findUnique({
      where: { id: messageId },
      include: { readBy: { select: { userId: true } } },
    });
    if (!message) {
      throw new Error("Message not found");
    }

    const senderId = message.senderId;
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

    const updated = await prisma.communityMessage.update({
      where: { id: message.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        content: "Message deleted",
      },
    });

    const conversation = await prisma.communityConversation.findUnique({
      where: { id: message.conversationId },
      select: {
        conversationType: true,
        participants: { select: { userId: true } },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participants = conversation.participants.map(
      (participant) => participant.userId,
    );

    return {
      id: updated.id,
      conversationId: updated.conversationId,
      conversationType: conversation.conversationType || "DM",
      senderId,
      type: updated.type || "TEXT",
      content: "Message deleted",
      metadata: null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      editedAt: updated.editedAt || null,
      isEdited: Boolean(updated.editedAt),
      isDeleted: true,
      readBy: (message.readBy || []).map((receipt) => receipt.userId),
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
      const message = await prisma.communityMessage.findUnique({
        where: { id: payload.targetId },
        select: {
          id: true,
          senderId: true,
          createdAt: true,
          updatedAt: true,
          editedAt: true,
          deletedAt: true,
          isDeleted: true,
        },
      });
      if (!message) {
        throw new Error("message not found");
      }

      messageAudit = {
        senderId: message.senderId,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        editedAt: message.editedAt || null,
        deletedAt: message.deletedAt || null,
        wasEdited: Boolean(message.editedAt),
        wasDeleted: Boolean(message.isDeleted),
      };
    } else if (payload.targetType === "GROUP") {
      const group = await prisma.communityGroup.findUnique({
        where: { id: payload.targetId },
        select: { id: true },
      });
      if (!group) {
        throw new Error("group not found");
      }
    } else if (payload.targetType === "POST") {
      const post = await prisma.communityPost.findUnique({
        where: { id: payload.targetId },
        select: { id: true },
      });
      if (!post) {
        throw new Error("post not found");
      }
    } else {
      const answer = await prisma.communityAnswer.findUnique({
        where: { id: payload.targetId },
        select: { id: true },
      });
      if (!answer) {
        throw new Error("answer not found");
      }
    }

    const report = await prisma.communityReport.create({
      data: {
        reporterUserId: userId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        reason: payload.reason.trim(),
        details: payload.details?.trim() || "",
        status: "OPEN",
        ...(messageAudit
          ? {
              maSenderId: messageAudit.senderId,
              maCreatedAt: messageAudit.createdAt,
              maUpdatedAt: messageAudit.updatedAt,
              maEditedAt: messageAudit.editedAt,
              maDeletedAt: messageAudit.deletedAt,
              maWasEdited: messageAudit.wasEdited,
              maWasDeleted: messageAudit.wasDeleted,
            }
          : {}),
      },
    });

    return {
      id: report.id,
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
      prisma.communityReport.findMany({
        where: { reporterUserId: userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      prisma.communityReport.count({ where: { reporterUserId: userId } }),
    ]);

    return {
      items: items.map((item) => {
        const hasAudit =
          item.maSenderId !== null ||
          item.maCreatedAt !== null ||
          item.maWasEdited ||
          item.maWasDeleted;

        return {
          id: item.id,
          targetType: item.targetType,
          targetId: item.targetId,
          reason: item.reason,
          details: item.details || "",
          status: item.status,
          resolutionNote: item.resolutionNote || "",
          createdAt: item.createdAt,
          reviewedAt: item.reviewedAt || null,
          messageAudit: hasAudit
            ? {
                senderId: item.maSenderId ?? undefined,
                createdAt: item.maCreatedAt || null,
                updatedAt: item.maUpdatedAt || null,
                editedAt: item.maEditedAt || null,
                deletedAt: item.maDeletedAt || null,
                wasEdited: Boolean(item.maWasEdited),
                wasDeleted: Boolean(item.maWasDeleted),
              }
            : undefined,
        };
      }),
      pagination: {
        total,
        page: safePage,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  },

  async touchLastSeen(userId: string) {
    await prisma.communityProfile.upsert({
      where: { userId },
      create: {
        userId,
        anonymousAlias: makeDefaultAlias(),
        lastSeenAt: new Date(),
      },
      update: { lastSeenAt: new Date() },
    });
  },

  async assertConversationAccess(userId: string, conversationId: string) {
    const conversation = await prisma.communityConversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.userId === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    return conversation;
  },

  formatSocketParticipant(
    selfId: string,
    participant: {
      _id: unknown;
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

  async getParticipantIds(conversation: ConversationWithParticipants) {
    return conversation.participants.map((participant) => participant.userId);
  },

  async getGroupMembers(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { members: { select: { userId: true } } },
    });

    if (!group) {
      throw new Error("Group not found");
    }

    const memberIds = group.members.map((member) => member.userId);
    const isMember = memberIds.includes(userId);
    if (!isMember) {
      throw new Error("Access denied");
    }

    const [memberUsers, memberProfiles] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, name: true, photoUrl: true, photoS3Key: true },
      }),
      prisma.communityProfile.findMany({
        where: { userId: { in: memberIds } },
        select: {
          userId: true,
          anonymousAlias: true,
          isIdentityPublic: true,
          lastSeenAt: true,
        },
      }),
    ]);

    const userMap = new Map(memberUsers.map((user) => [user.id, user]));
    const profileMap = new Map(
      memberProfiles.map((profile) => [profile.userId, profile]),
    );

    return Promise.all(
      memberIds.map(async (memberId) => {
        const member = userMap.get(memberId);
        const profile = profileMap.get(memberId);
        const isIdentityPublic = profile?.isIdentityPublic ?? true;

        return {
          id: memberId,
          name: member?.name || "Unknown",
          displayName: isIdentityPublic
            ? member?.name
            : profile?.anonymousAlias || "Anonymous",
          photoUrl: isIdentityPublic ? await resolveUserPhotoUrl(member) : null,
          isIdentityPublic,
          alias: profile?.anonymousAlias || "Anonymous",
        };
      }),
    );
  },

  async joinGroupByCode(userId: string, inviteCode: string) {
    await ensureProfile(userId);
    const userRole = await getCommunityRole(userId);

    const group = await prisma.communityGroup.findFirst({
      where: { inviteCode: inviteCode.trim() },
      include: { members: true },
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

    const alreadyMember = group.members.some(
      (member) => member.userId === userId,
    );
    if (alreadyMember) {
      // Already a member, just return the group info
      const conversation = await prisma.communityConversation.findFirst({
        where: { conversationType: "GROUP", groupId: group.id },
      });

      return {
        groupId: group.id,
        conversationId: conversation?.id || "",
        memberCount: group.members.length,
      };
    }

    await prisma.communityGroupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: { groupId: group.id, userId, role: "MEMBER" },
      update: {},
    });

    let conversation = await prisma.communityConversation.findFirst({
      where: { conversationType: "GROUP", groupId: group.id },
    });
    if (!conversation) {
      conversation = await prisma.communityConversation.create({
        data: {
          conversationType: "GROUP",
          groupId: group.id,
          participantKey: buildGroupParticipantKey(group.id),
          status: "ACTIVE",
          requestedBy: group.createdBy,
          lastMessageAt: new Date(),
          participants: { create: [{ userId }] },
        },
      });
    } else {
      await prisma.conversationParticipant.upsert({
        where: {
          conversationId_userId: { conversationId: conversation.id, userId },
        },
        create: { conversationId: conversation.id, userId },
        update: {},
      });
    }

    const adminIds = group.members
      .filter((member) => member.role === "ADMIN")
      .map((member) => member.userId)
      .filter((adminId) => adminId !== userId);

    for (const adminId of adminIds) {
      sendCommunityNotification(
        adminId,
        "New member joined via invite",
        `A member joined ${group.name} using an invite code.`,
        {
          event: "COMMUNITY_GROUP_JOINED",
          groupId: group.id,
          conversationId: conversation?.id || "",
          actorUserId: userId,
        },
      );
    }

    return {
      groupId: group.id,
      conversationId: conversation?.id || "",
      memberCount: group.members.length + 1,
    };
  },

  async getGroupInviteCode(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new Error("Group not found");
    }

    const isAdmin = group.members.some(
      (member) => member.role === "ADMIN" && member.userId === userId,
    );
    if (!isAdmin) {
      throw new Error("Only group admins can get invite code");
    }

    let inviteCode =
      typeof group.inviteCode === "string" ? group.inviteCode.trim() : "";
    if (!inviteCode) {
      do {
        inviteCode = generateInviteCode();
      } while (
        await prisma.communityGroup.findFirst({
          where: { inviteCode },
          select: { id: true },
        })
      );

      await prisma.communityGroup.update({
        where: { id: group.id },
        data: { inviteCode },
      });
    }

    return {
      groupId: group.id,
      inviteCode,
    };
  },

  async getCommunityPulseStats() {
    const [postsCount, groupsCount] = await Promise.all([
      prisma.communityPost.count(),
      prisma.communityGroup.count(),
    ]);
    const totalActivity = postsCount + groupsCount * 12;
    return totalActivity > 0 ? totalActivity : 1280;
  },
};
