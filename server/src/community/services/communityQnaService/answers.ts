import mongoose from "mongoose";
import { NotificationService } from "../../../client/services/NotificationService";
import { CommunityAnswer } from "../../models/CommunityAnswer";
import { CommunityAnswerComment } from "../../models/CommunityAnswerComment";
import { CommunityPost } from "../../models/CommunityPost";
import { CommunityReputation } from "../../models/CommunityReputation";
import {
  COMMUNITY_POINTS,
  adjustAcceptedAnswerReputation,
  ensureProfile,
  ensureQnaAllowedForRole,
  getCommunityRole,
  sendCommunityNotification,
  trackCommunityRoleMixEvent,
} from "../communityShared";
import { log as __rootLog } from "../../../utils/logger";
const log = __rootLog.child("communityQna");

export const answersService = {
  async createAnswer(userId: string, postId: string, content: string, isAnonymous = false) {
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
        log.error("Failed to send community answer notification:", error);
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
        { upsert: true }
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
      { $inc: { answerCount: -1 } }
    );

    // Comments hang off the answer; leaving them behind would orphan them and
    // let a deleted answer's discussion linger on the next page load.
    await CommunityAnswerComment.updateMany(
      { answerId: answer._id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    // A deleted answer must not stay marked as the accepted one — the post
    // would keep a "solved" badge pointing at content nobody can read, and the
    // author would keep points for it.
    const clearedAccepted = await CommunityPost.findOneAndUpdate(
      { _id: answer.postId, acceptedAnswerId: answer._id },
      { $set: { acceptedAnswerId: null } }
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
    isAnonymous = false
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
        }
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
      const post = await CommunityPost.findById(comment.postId).select("authorId").lean();
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
};
