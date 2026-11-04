import mongoose from "mongoose";
import { User } from "../../../client/models/User";
import { CommunityAnswer } from "../../models/CommunityAnswer";
import { CommunityAnswerComment } from "../../models/CommunityAnswerComment";
import { CommunityPost } from "../../models/CommunityPost";
import { CommunityProfile } from "../../models/CommunityProfile";
import { CommunityReputation } from "../../models/CommunityReputation";
import { CommunityVote } from "../../models/CommunityVote";
import { resolveCommunityCredentials } from "../communityCredentials";
import { normalizeTags } from "../communityQnaUtils";
import {
  COMMUNITY_POINTS,
  ensureProfile,
  ensureQnaAllowedForRole,
  getCommunityRole,
  normalizeOptionalText,
  resolvePublicViewerId,
  resolveUserPhotoUrl,
  splitCsvValues,
  trackCommunityRoleMixEvent,
} from "../communityShared";

export const postsService = {
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
    }
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
    const direction = (filters?.direction || "DESC").toUpperCase() as "ASC" | "DESC";

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
      CommunityPost.find(query).sort(sortClause).skip(skip).limit(safeLimit).lean(),
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
    const profileMap = new Map(profiles.map((profile) => [String(profile.userId), profile]));
    const voteMap = new Map(votes.map((vote) => [String(vote.targetId), vote]));
    const credentialMap = await resolveCommunityCredentials(
      posts.map((post) => String(post.authorId))
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
          const credential = isPostAnon ? undefined : credentialMap.get(authorId);

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
            acceptedAnswerId: post.acceptedAnswerId ? String(post.acceptedAnswerId) : null,
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
        })
      ),
      pagination: {
        total,
        page: safePage,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  },

  async getPostDetails(userId: string | undefined, postId: string, page = 1, limit = 30) {
    userId = await resolvePublicViewerId(userId);

    const post = await CommunityPost.findOne({
      _id: postId,
      isDeleted: false,
    }).lean();
    if (!post) {
      throw new Error("post not found");
    }

    // Fire-and-forget view increment — don't block the read on it.
    CommunityPost.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } }).catch(() => {});

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [acceptedAnswer, answerTotal, postAuthor, postAuthorProfile, myPostVote] =
      await Promise.all([
        post.acceptedAnswerId
          ? CommunityAnswer.findOne({
              _id: post.acceptedAnswerId,
              postId: post._id,
              isDeleted: false,
            }).lean()
          : Promise.resolve(null),
        CommunityAnswer.countDocuments({ postId: post._id, isDeleted: false }),
        User.findById(post.authorId).select("_id name photoUrl photoS3Key role").lean(),
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

    // The accepted answer is pinned to the very front of the thread. That
    // used to be `$addFields: { isAccepted }` + `$sort` inside an aggregate —
    // sorting on a field computed per-document, which no index (including
    // the existing {postId, voteScore, createdAt} one) can back, forcing an
    // in-memory sort of the whole thread on every request. Fetching it
    // separately by _id (already indexed) lets the remainder use that index
    // for its own sort instead.
    const showAcceptedThisPage = safePage === 1 && Boolean(acceptedAnswer);
    const restFilter: Record<string, unknown> = {
      postId: post._id,
      isDeleted: false,
    };
    if (acceptedAnswer) {
      restFilter._id = { $ne: acceptedAnswer._id };
    }
    const restSkip = showAcceptedThisPage ? 0 : acceptedAnswer ? skip - 1 : skip;
    const restLimit = showAcceptedThisPage ? Math.max(0, safeLimit - 1) : safeLimit;

    const restAnswers = restLimit
      ? await CommunityAnswer.find(restFilter)
          .sort({ voteScore: -1, createdAt: 1 })
          .skip(restSkip)
          .limit(restLimit)
          .lean()
      : [];

    const answers = showAcceptedThisPage
      ? [acceptedAnswer as NonNullable<typeof acceptedAnswer>, ...restAnswers]
      : restAnswers;

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
      answerUsers.map((answerUser) => [String(answerUser._id), answerUser])
    );
    const answerProfileMap = new Map(
      answerProfiles.map((answerProfile) => [String(answerProfile.userId), answerProfile])
    );
    const answerVoteMap = new Map(
      answerVotes.map((answerVote) => [String(answerVote.targetId), answerVote])
    );

    const postAuthorId = String(post.authorId);
    const isPostAuthorSelf = Boolean(userId) && postAuthorId === userId;
    const isPostAnon = post.isAnonymous && !isPostAuthorSelf;

    // Fetched for the whole page at once — a request per answer would be 20
    // round-trips on a busy thread, and comments are small. Capped as a
    // safety ceiling: unlike the answers themselves, comments here have no
    // per-answer pagination, so one heavily-commented answer on the page
    // could otherwise make the response unbounded.
    const MAX_ANSWER_COMMENTS_PER_PAGE = 500;
    const comments = await CommunityAnswerComment.find({
      answerId: { $in: answers.map((item) => item._id) },
      isDeleted: false,
    })
      .sort({ createdAt: 1 })
      .limit(MAX_ANSWER_COMMENTS_PER_PAGE)
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
    const commentUserMap = new Map(commentUsers.map((item) => [String(item._id), item]));
    const commentProfileMap = new Map(commentProfiles.map((item) => [String(item.userId), item]));

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
    const postAuthorCredential = isPostAnon ? undefined : credentialMap.get(postAuthorId);

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
        acceptedAnswerId: post.acceptedAnswerId ? String(post.acceptedAnswerId) : null,
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
          isIdentityPublic: post.isAnonymous
            ? false
            : (postAuthorProfile?.isIdentityPublic ?? true),
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
          const answerCredential = isAnswerAnon ? undefined : credentialMap.get(answerAuthorId);

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
            isAccepted: String(post.acceptedAnswerId || "") === String(answer._id),
            comments: (commentsByAnswer.get(String(answer._id)) || []).map(shapeComment),
            author: {
              id: isAnswerAnon ? "anon" : answerAuthorId,
              displayName: answer.isAnonymous
                ? "Anonymous"
                : isAnswerSelf
                  ? answerUser?.name || "Me"
                  : answerProfile?.isIdentityPublic
                    ? answerUser?.name || "Player"
                    : answerProfile?.anonymousAlias || "Anonymous Player",
              isIdentityPublic: answer.isAnonymous
                ? false
                : (answerProfile?.isIdentityPublic ?? true),
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
        })
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
    }
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
      { upsert: true }
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
    }
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
};
