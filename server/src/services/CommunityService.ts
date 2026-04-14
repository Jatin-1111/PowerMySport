import mongoose from "mongoose";
import {
  CommunityConversation,
  CommunityConversationDocument,
} from "../models/CommunityConversation";
import { CommunityGroup } from "../models/CommunityGroup";
import { CommunityMessage } from "../models/CommunityMessage";
import {
  CommunityMessagePrivacy,
  CommunityProfile,
} from "../models/CommunityProfile";
import { User } from "../models/User";
import { CommunityReport } from "../models/CommunityReport";
import { CommunityPost } from "../models/CommunityPost";
import { CommunityAnswer } from "../models/CommunityAnswer";
import { CommunityVote } from "../models/CommunityVote";
import { CommunityReputation } from "../models/CommunityReputation";
import { NotificationService } from "./NotificationService";
import { S3Service } from "./S3Service";
import {
  canJoinGroupAudience,
  COMMUNITY_INTERACTION_POLICY,
  isCrossRoleInteraction,
  ROLE_LABEL,
  type CommunityGroupAudience,
  type CommunityRole,
} from "./communityPolicy";
import { getVoteTransitionDeltas, normalizeTags } from "./communityQnaUtils";

const buildParticipantKey = (a: string, b: string): string =>
  [a, b].sort().join(":");

const normalizeOptionalText = (value?: string): string => value?.trim() || "";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MESSAGE_EDIT_DELETE_WINDOW_MS = 30 * 60 * 1000;
const COMMUNITY_ALLOWED_ROLES = ["PLAYER", "COACH"] as const;
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

  if (!COMMUNITY_ALLOWED_ROLES.includes(user.role as "PLAYER" | "COACH")) {
    throw new Error(
      "Community is available only for player and coach accounts",
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
    isIdentityPublic: profile?.isIdentityPublic || false,
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
      | "NEW"
      | "TOP"
      | "UNANSWERED";

    const query: Record<string, unknown> = {
      isDeleted: false,
      status: { $in: ["OPEN", "CLOSED"] },
    };

    if (filters?.mine) {
      query.authorId = userId;
    }

    const search = (filters?.q || "").trim();
    if (search) {
      query.$text = { $search: search };
    }

    const tag = (filters?.tag || "").trim().toLowerCase();
    if (tag) {
      query.tags = tag;
    }

    const sport = normalizeOptionalText(filters?.sport);
    if (sport) {
      query.sport = sport;
    }

    const city = normalizeOptionalText(filters?.city);
    if (city) {
      query.city = city;
    }

    if (sort === "UNANSWERED") {
      query.answerCount = 0;
    }

    const sortClause =
      sort === "TOP"
        ? ({ voteScore: -1 as const, createdAt: -1 as const } as const)
        : { createdAt: -1 as const };

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
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: authorIds } })
        .select("userId anonymousAlias isIdentityPublic")
        .lean(),
      CommunityVote.find({
        userId,
        targetType: "POST",
        targetId: { $in: posts.map((post) => post._id) },
      })
        .select("targetId value")
        .lean(),
    ]);

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.userId), profile]),
    );
    const voteMap = new Map(votes.map((vote) => [String(vote.targetId), vote]));

    return {
      items: await Promise.all(
        posts.map(async (post) => {
          const authorId = String(post.authorId);
          const author = userMap.get(authorId);
          const profile = profileMap.get(authorId);

          return {
            id: String(post._id),
            title: post.title,
            body: post.body,
            tags: post.tags,
            sport: post.sport || "",
            city: post.city || "",
            status: post.status,
            voteScore: post.voteScore || 0,
            upvoteCount: post.upvoteCount || 0,
            downvoteCount: post.downvoteCount || 0,
            answerCount: post.answerCount || 0,
            viewCount: post.viewCount || 0,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            myVote: voteMap.get(String(post._id))?.value || 0,
            author: {
              id: authorId,
              displayName:
                authorId === userId
                  ? author?.name || "Me"
                  : profile?.isIdentityPublic
                    ? author?.name || "Player"
                    : profile?.anonymousAlias || "Anonymous Player",
              isIdentityPublic: profile?.isIdentityPublic || false,
              photoUrl:
                profile?.isIdentityPublic && author
                  ? await resolveUserPhotoUrl(author)
                  : null,
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
        CommunityAnswer.find({ postId: post._id, isDeleted: false })
          .sort({ voteScore: -1, createdAt: 1 })
          .skip(skip)
          .limit(safeLimit)
          .lean(),
        CommunityAnswer.countDocuments({ postId: post._id, isDeleted: false }),
        User.findById(post.authorId)
          .select("_id name photoUrl photoS3Key")
          .lean(),
        CommunityProfile.findOne({ userId: post.authorId })
          .select("userId anonymousAlias isIdentityPublic")
          .lean(),
        CommunityVote.findOne({
          userId,
          targetType: "POST",
          targetId: post._id,
        })
          .select("value")
          .lean(),
      ]);

    const answerAuthorIds = answers.map((item) => String(item.authorId));
    const [answerUsers, answerProfiles, answerVotes] = await Promise.all([
      User.find({ _id: { $in: answerAuthorIds } })
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: answerAuthorIds } })
        .select("userId anonymousAlias isIdentityPublic")
        .lean(),
      CommunityVote.find({
        userId,
        targetType: "ANSWER",
        targetId: { $in: answers.map((item) => item._id) },
      })
        .select("targetId value")
        .lean(),
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
    return {
      post: {
        id: String(post._id),
        title: post.title,
        body: post.body,
        tags: post.tags,
        sport: post.sport || "",
        city: post.city || "",
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
          id: postAuthorId,
          displayName:
            postAuthorId === userId
              ? postAuthor?.name || "Me"
              : postAuthorProfile?.isIdentityPublic
                ? postAuthor?.name || "Player"
                : postAuthorProfile?.anonymousAlias || "Anonymous Player",
          isIdentityPublic: postAuthorProfile?.isIdentityPublic || false,
          photoUrl:
            postAuthorProfile?.isIdentityPublic && postAuthor
              ? await resolveUserPhotoUrl(postAuthor)
              : null,
        },
      },
      answers: await Promise.all(
        answers.map(async (answer) => {
          const answerAuthorId = String(answer.authorId);
          const answerUser = answerUserMap.get(answerAuthorId);
          const answerProfile = answerProfileMap.get(answerAuthorId);

          return {
            id: String(answer._id),
            postId: String(answer.postId),
            content: answer.content,
            voteScore: answer.voteScore || 0,
            upvoteCount: answer.upvoteCount || 0,
            downvoteCount: answer.downvoteCount || 0,
            createdAt: answer.createdAt,
            updatedAt: answer.updatedAt,
            myVote: answerVoteMap.get(String(answer._id))?.value || 0,
            author: {
              id: answerAuthorId,
              displayName:
                answerAuthorId === userId
                  ? answerUser?.name || "Me"
                  : answerProfile?.isIdentityPublic
                    ? answerUser?.name || "Player"
                    : answerProfile?.anonymousAlias || "Anonymous Player",
              isIdentityPublic: answerProfile?.isIdentityPublic || false,
              photoUrl:
                answerProfile?.isIdentityPublic && answerUser
                  ? await resolveUserPhotoUrl(answerUser)
                  : null,
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
    });

    await CommunityReputation.updateOne(
      { userId },
      {
        $setOnInsert: {
          totalPoints: 0,
          questionCount: 0,
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

  async createAnswer(userId: string, postId: string, content: string) {
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
            totalPoints: 0,
            questionCount: 0,
            answerCount: 0,
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

    return {
      id: String(answer._id),
      postId: String(answer.postId),
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
            totalPoints: 0,
            questionCount: 0,
            answerCount: 0,
            receivedUpvotes: 0,
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

  async searchPlayers(userId: string, query: string, limit = 10) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const safeLimit = Math.min(20, Math.max(1, limit));
    const profile = await ensureProfile(userId);
    const regex = new RegExp(escapeRegex(normalizedQuery), "i");

    const [nameMatches, aliasMatches] = await Promise.all([
      User.find({
        role: { $in: COMMUNITY_ALLOWED_ROLES },
        name: regex,
        _id: { $ne: userId },
      })
        .select("_id name photoUrl photoS3Key")
        .limit(safeLimit * 3)
        .lean(),
      CommunityProfile.find({ anonymousAlias: regex, userId: { $ne: userId } })
        .select("userId")
        .limit(safeLimit * 3)
        .lean(),
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
        .select("_id name photoUrl photoS3Key role")
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
          const isIdentityPublic = candidateProfile?.isIdentityPublic || false;
          const displayName = isIdentityPublic
            ? user.name
            : candidateProfile?.anonymousAlias || "Anonymous Member";

          return {
            id: candidateId,
            displayName,
            isIdentityPublic,
            role: user.role,
            photoUrl: isIdentityPublic ? null : null,
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, safeLimit),
    ).then((items) =>
      Promise.all(
        items.map(async (item) => ({
          ...item,
          photoUrl:
            item.isIdentityPublic && item.id
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
          "_id name photoUrl photoS3Key role playerProfile dob createdAt lastActiveAt",
        )
        .lean(),
      CommunityProfile.findOne({ userId: targetUserId })
        .select(
          "userId anonymousAlias isIdentityPublic messagePrivacy readReceiptsEnabled lastSeenVisible lastSeenAt blockedUsers",
        )
        .lean(),
    ]);

    const targetRole = targetUser?.role as
      | (typeof COMMUNITY_ALLOWED_ROLES)[number]
      | undefined;

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
      isIdentityPublic: false,
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
      photoUrl: isIdentityPublic ? await resolveUserPhotoUrl(targetUser) : null,
      sports: Array.isArray(targetUser.playerProfile?.sports)
        ? targetUser.playerProfile.sports
        : [],
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

  async listGroups(userId: string, query = "", limit = 20) {
    await ensureProfile(userId);

    const normalizedQuery = query.trim();
    const safeLimit = Math.min(50, Math.max(1, limit));
    const regex = normalizedQuery
      ? new RegExp(escapeRegex(normalizedQuery), "i")
      : null;

    const filter = regex
      ? {
          visibility: "PUBLIC",
          $or: [{ name: regex }, { sport: regex }, { city: regex }],
        }
      : { visibility: "PUBLIC" };

    const groups = await CommunityGroup.find(filter)
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    return groups.map((group) => {
      const memberIds = group.members.map((memberId) => String(memberId));
      const adminIds = group.admins.map((adminId) => String(adminId));
      return {
        id: String(group._id),
        name: group.name,
        description: group.description || "",
        visibility: group.visibility,
        audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
        sport: group.sport || "",
        city: group.city || "",
        createdBy: String(group.createdBy),
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
      audience?: CommunityGroupAudience;
    },
  ) {
    await ensureProfile(userId);

    const creatorRole = await getCommunityRole(userId);

    const name = payload.name.trim();
    if (!name) {
      throw new Error("Group name is required");
    }

    const group = await CommunityGroup.create({
      name,
      description: normalizeOptionalText(payload.description),
      sport: normalizeOptionalText(payload.sport),
      city: normalizeOptionalText(payload.city),
      visibility: "PUBLIC",
      memberAddPolicy: "ADMIN_ONLY",
      audience: payload.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
      createdBy: userId,
      members: [userId],
      admins: [userId],
      inviteCode: generateInviteCode(),
    });

    trackCommunityRoleMixEvent("group_created", {
      groupId: String(group._id),
      createdByRole: creatorRole,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
    });

    const conversation = await CommunityConversation.create({
      conversationType: "GROUP",
      groupId: group._id,
      participants: [userId],
      status: "ACTIVE",
      requestedBy: userId,
      lastMessageAt: new Date(),
    });

    return {
      id: String(group._id),
      name: group.name,
      description: group.description || "",
      visibility: group.visibility,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
      sport: group.sport || "",
      city: group.city || "",
      memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
      memberCount: group.members.length,
      conversationId: String(conversation._id),
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

    const requesterIsAdmin = group.admins.some(
      (adminId) => String(adminId) === userId,
    );
    if (!requesterIsAdmin) {
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

    const alreadyMember = group.members.some(
      (memberId) => String(memberId) === userId,
    );
    if (!alreadyMember) {
      group.members.push(new mongoose.Types.ObjectId(userId));
      await group.save();

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

    return {
      groupId: String(group._id),
      conversationId: String(conversation?._id || ""),
      memberCount: group.members.length,
    };
  },

  async leaveGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const wasMember = group.members.some(
      (memberId) => String(memberId) === userId,
    );
    if (!wasMember) {
      return { groupId, removed: false };
    }

    group.members = group.members.filter(
      (memberId) => String(memberId) !== userId,
    );
    group.admins = group.admins.filter((adminId) => String(adminId) !== userId);

    if (!group.admins.length && group.members.length) {
      const fallbackAdmin = group.members[0];
      if (fallbackAdmin) {
        group.admins = [fallbackAdmin];
      }
    }

    const groupConversation = await CommunityConversation.findOne({
      conversationType: "GROUP",
      groupId: group._id,
    });

    if (groupConversation) {
      groupConversation.participants = groupConversation.participants.filter(
        (participantId) => String(participantId) !== userId,
      );

      if (!groupConversation.participants.length || !group.members.length) {
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

    if (!group.members.length) {
      await CommunityGroup.deleteOne({ _id: group._id });
      return { groupId: String(group._id), removed: true, deletedGroup: true };
    }

    await group.save();
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

    const requesterIsAdmin = group.admins.some(
      (adminId) => String(adminId) === userId,
    );
    const requesterIsMember = group.members.some(
      (memberId) => String(memberId) === userId,
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
      (memberId) => String(memberId) === targetUserId,
    );
    if (!alreadyMember) {
      group.members.push(new mongoose.Types.ObjectId(targetUserId));
      await group.save();
    }

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
          participants: new mongoose.Types.ObjectId(targetUserId),
        },
      },
      { upsert: true, new: true },
    );

    return {
      groupId: String(group._id),
      conversationId: String(conversation?._id || ""),
      memberCount: group.members.length,
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

    await Promise.all([
      CommunityMessage.deleteMany({ conversationId: conversation._id }),
      CommunityConversation.deleteOne({ _id: conversation._id }),
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
          },
        },
      ]),
      CommunityGroup.find({ _id: { $in: groupConversationIds } })
        .select("_id name description visibility sport city members")
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
        const groupMemberCount = group?.members?.length || 0;

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
                : otherProfile?.isIdentityPublic || false,
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
                content: latest.isDeleted ? "Message deleted" : latest.content,
                createdAt: latest.createdAt,
                senderId: String(latest.senderId),
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

    await this.markConversationRead(userId, conversationId);

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
        senderDisplayName: isSelf
          ? sender?.name || "Me"
          : senderProfile?.isIdentityPublic
            ? sender?.name || "Player"
            : senderProfile?.anonymousAlias || "Anonymous Player",
        content: message.isDeleted ? "Message deleted" : message.content,
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
            .select("_id name description visibility sport city members")
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
                memberCount: group?.members?.length || 0,
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

  async sendMessage(userId: string, conversationId: string, content: string) {
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

    const message = await CommunityMessage.create({
      conversationId,
      senderId: userId,
      content: content.trim(),
      readBy: [new mongoose.Types.ObjectId(userId)],
    });

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

    return {
      id: String(message._id),
      conversationId: String(message.conversationId),
      conversationType: conversation.conversationType || "DM",
      senderId: String(message.senderId),
      senderDisplayName: senderProfile?.isIdentityPublic
        ? sender?.name || "Player"
        : senderProfile?.anonymousAlias || "Anonymous Player",
      content: message.content,
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
      content: message.content,
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
      content: "Message deleted",
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

    const group = await CommunityGroup.findById(groupId)
      .populate("members", "_id name photoUrl photoS3Key")
      .lean();

    if (!group) {
      throw new Error("Group not found");
    }

    const isMember = group.members.some((member: any) => {
      const memberId = member?._id ? String(member._id) : String(member);
      return memberId === userId;
    });
    if (!isMember) {
      throw new Error("Access denied");
    }

    const memberProfiles = await CommunityProfile.find({
      userId: { $in: group.members.map((m) => m._id) },
    })
      .select(
        "userId anonymousAlias isIdentityPublic photoUrl photoS3Key lastSeenAt",
      )
      .lean();

    const profileMap = new Map(
      memberProfiles.map((p) => [String(p.userId), p]),
    );

    return Promise.all(
      group.members.map(async (member: any) => {
        const memberId = String(member._id);
        const profile = profileMap.get(memberId);
        const isIdentityPublic = profile?.isIdentityPublic || false;

        return {
          id: memberId,
          name: member.name || "Unknown",
          displayName: isIdentityPublic
            ? member.name
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

    const group = await CommunityGroup.findOne({
      inviteCode: inviteCode.trim(),
    });

    if (!group) {
      throw new Error("Invalid invite code");
    }

    const alreadyMember = group.members.some(
      (memberId) => String(memberId) === userId,
    );
    if (alreadyMember) {
      // Already a member, just return the group info
      const conversation = await CommunityConversation.findOne({
        conversationType: "GROUP",
        groupId: group._id,
      });

      return {
        groupId: String(group._id),
        conversationId: String(conversation?._id || ""),
        memberCount: group.members.length,
      };
    }

    group.members.push(new mongoose.Types.ObjectId(userId));
    await group.save();

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

    return {
      groupId: String(group._id),
      conversationId: String(conversation?._id || ""),
      memberCount: group.members.length,
    };
  },

  async getGroupInviteCode(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    const isAdmin = group.admins.some((adminId) => String(adminId) === userId);
    if (!isAdmin) {
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
};
