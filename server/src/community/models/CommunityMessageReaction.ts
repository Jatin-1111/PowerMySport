import mongoose, { Document, Schema } from "mongoose";

export interface CommunityMessageReactionDocument extends Document {
  messageId: mongoose.Types.ObjectId;
  /** Denormalized so a page of reactions loads in one query, and so a whole
   *  conversation's reactions can be cleared without walking its messages. */
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  emoji: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reactions live in their own collection rather than an array on the message.
 *
 * A message is a hot document — it is read on every page of a conversation and
 * written by read receipts and delivery marks. Embedding reactions would make
 * every reaction a read-modify-write of that document, so two people reacting
 * at the same moment could lose one of the two. A row per (message, user)
 * makes the unique index the arbiter instead.
 */
const communityMessageReactionSchema = new Schema<CommunityMessageReactionDocument>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityMessage",
      required: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityConversation",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: {
      type: String,
      required: true,
      trim: true,
      // Long enough for a multi-codepoint emoji (skin tone, ZWJ sequences),
      // short enough that this cannot become a second message body.
      maxlength: 16,
    },
  },
  { timestamps: true }
);

// One reaction per person per message: reacting again replaces, never stacks.
// Also serves the read path (every reaction on the messages of one page) —
// a `{messageId:1}`-only query uses this compound index's leading field, so
// a separate single-field index on `messageId` would be pure write overhead
// with no read it serves that this doesn't already. Dropped in production by
// migration 33.
communityMessageReactionSchema.index({ messageId: 1, userId: 1 }, { unique: true });

export const CommunityMessageReaction = mongoose.model<CommunityMessageReactionDocument>(
  "CommunityMessageReaction",
  communityMessageReactionSchema
);
