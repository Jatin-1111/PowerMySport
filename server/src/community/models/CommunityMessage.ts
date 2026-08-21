import mongoose, { Document, Schema } from "mongoose";

export type CommunityMessageType = "TEXT" | "IMAGE";

export interface CommunityMessageDocument extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  type: CommunityMessageType;
  content: string;
  metadata?: {
    width?: number;
    height?: number;
    caption?: string;
  };
  /** The message this one is a reply to. Kept as a reference rather than a
   *  copied snippet so an edit to the original is reflected in the quote,
   *  and a deletion is visible rather than leaving stale text quoted. */
  replyToId?: mongoose.Types.ObjectId | null;
  readBy: mongoose.Types.ObjectId[];
  deliveredTo: mongoose.Types.ObjectId[];
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  editedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const communityMessageSchema = new Schema<CommunityMessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityConversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["TEXT", "IMAGE"],
      default: "TEXT",
      index: true,
    },
    content: {
      // For TEXT messages: the message text.
      // For IMAGE messages: the S3 object key (never the full URL).
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    metadata: {
      // Stored for IMAGE messages to prevent layout shift on render.
      width: { type: Number },
      height: { type: Number },
      caption: { type: String, maxlength: 2000 },
    },
    replyToId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityMessage",
      default: null,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deliveredTo: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

communityMessageSchema.index({ conversationId: 1, createdAt: -1 });
communityMessageSchema.index({
  conversationId: 1,
  senderId: 1,
  createdAt: -1,
});
communityMessageSchema.index({ conversationId: 1, readBy: 1, createdAt: -1 });

export const CommunityMessage = mongoose.model<CommunityMessageDocument>(
  "CommunityMessage",
  communityMessageSchema,
);
