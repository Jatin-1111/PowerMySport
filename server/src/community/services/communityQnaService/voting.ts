import mongoose from "mongoose";
import { NotificationService } from "../../../client/services/NotificationService";
import { CommunityAnswer } from "../../models/CommunityAnswer";
import { CommunityPost } from "../../models/CommunityPost";
import { CommunityReputation } from "../../models/CommunityReputation";
import { CommunityVote } from "../../models/CommunityVote";
import { getVoteTransitionDeltas } from "../communityQnaUtils";
import {
  COMMUNITY_POINTS,
  adjustAcceptedAnswerReputation,
  ensureProfile,
  sendCommunityNotification,
} from "../communityShared";
import { log as __rootLog } from "../../../utils/logger";
const log = __rootLog.child("communityQna");

export const votingService = {
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
          }
        );
      }
    }

    return {
      postId: String(post._id),
      answerId: String(answer._id),
      accepted: !wasAccepted,
      acceptedAnswerId: post.acceptedAnswerId ? String(post.acceptedAnswerId) : null,
    };
  },

  async vote(
    userId: string,
    payload: {
      targetType: "POST" | "ANSWER";
      targetId: string;
      value: 1 | -1;
    }
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
        }
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
        }
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
        { upsert: true }
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
              ? String((updatedTarget as { postId?: mongoose.Types.ObjectId })?.postId || "")
              : payload.targetId,
        },
      }).catch((error: unknown) => {
        log.error("Failed to send community upvote notification:", error);
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
          ? String((updatedTarget as { postId?: mongoose.Types.ObjectId })?.postId || "")
          : payload.targetId,
    };
  },
};
