import {
  User,
} from "../../client/models/User";
import {
  NotificationService,
} from "../../client/services/NotificationService";
import {
  CommunityAnswer,
} from "../models/CommunityAnswer";
import {
  CommunityAnswerComment,
} from "../models/CommunityAnswerComment";
import {
  CommunityPost,
} from "../models/CommunityPost";
import {
  CommunityProfile,
} from "../models/CommunityProfile";
import {
  CommunityReputation,
} from "../models/CommunityReputation";
import {
  CommunityVote,
} from "../models/CommunityVote";
import {
  resolveCommunityCredentials,
} from "./communityCredentials";
import {
  getVoteTransitionDeltas,
  normalizeTags,
} from "./communityQnaUtils";
import {
  COMMUNITY_POINTS,
  adjustAcceptedAnswerReputation,
  ensureProfile,
  ensureQnaAllowedForRole,
  getCommunityRole,
  normalizeOptionalText,
  resolvePublicViewerId,
  resolveUserPhotoUrl,
  sendCommunityNotification,
  splitCsvValues,
  trackCommunityRoleMixEvent,
} from "./communityShared";
import mongoose from "mongoose";

/**
 * Questions, answers, answer comments, accepted answers and voting.
 *
 * Split out of CommunityService, which had grown to 4,400 lines. Composed back
 * into that object, so every existing `CommunityService.x()` call site is
 * unchanged.
 */
export const communityQnaService = {
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
};
