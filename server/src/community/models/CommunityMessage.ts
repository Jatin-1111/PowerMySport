import mongoose, { Document, Schema } from "mongoose";

export type CommunityMessageType = "TEXT" | "IMAGE" | "FILE" | "VOICE";

export interface CommunityMessageDocument extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  type: CommunityMessageType;
  content: string;
  metadata?: {
    width?: number;
    height?: number;
    caption?: string;
    /** FILE: the name to show and to download as — never used as the S3 key,
     *  which is generated server-side. */
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    /** VOICE: clip length, so the player can render a duration before the
     *  audio has loaded. */
    durationMs?: number;
    /** VOICE: amplitude peaks, 0-100, computed once by the recorder. Storing
     *  them means every viewer draws the same waveform without downloading and
     *  decoding the audio first — a thread of voice notes would otherwise fetch
     *  and decode every clip just to paint bars. */
    waveform?: number[];
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
      enum: ["TEXT", "IMAGE", "FILE", "VOICE"],
      default: "TEXT",
      index: true,
    },
    content: {
      // TEXT: the message text.
      // IMAGE / FILE / VOICE: the S3 object key (never the full URL).
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
      fileName: { type: String, maxlength: 255 },
      fileSize: { type: Number, min: 0 },
      mimeType: { type: String, maxlength: 100 },
      durationMs: { type: Number, min: 0 },
      waveform: {
        type: [Number],
        default: undefined,
        validate: {
          validator: (value: number[]) => !value || value.length <= 64,
          message: "A waveform can have at most 64 bars",
        },
      },
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
