import mongoose, { Document, Schema } from "mongoose";

export interface CommunityAnswerCommentDocument extends Document {
  answerId: mongoose.Types.ObjectId;
  /** Denormalized so a whole thread's comments can be fetched in one query and
   *  cleaned up when the question goes, without walking every answer first. */
  postId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  content: string;
  isAnonymous: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A short remark on an answer — "which model?", "this worked for us too" —
 * that would otherwise be posted as an answer and dilute the list.
 *
 * Deliberately smaller than an answer in every way: capped at 600 characters,
 * no votes, and no reputation. Comments carry no score precisely so they are
 * not worth farming; anything substantial enough to deserve points belongs in
 * an answer, where it can be voted on and accepted.
 */
const communityAnswerCommentSchema =
  new Schema<CommunityAnswerCommentDocument>(
    {
      answerId: {
        type: Schema.Types.ObjectId,
        ref: "CommunityAnswer",
        required: true,
      },
      postId: {
        type: Schema.Types.ObjectId,
        ref: "CommunityPost",
        required: true,
        index: true,
      },
      authorId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      content: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 600,
      },
      isAnonymous: { type: Boolean, default: false },
      isDeleted: { type: Boolean, default: false },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  );

// The only read path: a thread's comments, oldest first, per answer.
communityAnswerCommentSchema.index({ answerId: 1, isDeleted: 1, createdAt: 1 });

export const CommunityAnswerComment =
  mongoose.model<CommunityAnswerCommentDocument>(
    "CommunityAnswerComment",
    communityAnswerCommentSchema,
  );
