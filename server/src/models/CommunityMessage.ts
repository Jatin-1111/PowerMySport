import mongoose, { Document, Schema } from "mongoose";

export interface CommunityMessageDocument extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  readBy: mongoose.Types.ObjectId[];
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
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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
