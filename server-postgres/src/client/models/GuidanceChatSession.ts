import mongoose, { Document, Schema } from "mongoose";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface GuidanceChatSessionDocument extends Document {
  submissionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  messages: ChatMessage[];
  totalMessageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<ChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const guidanceChatSessionSchema = new Schema<GuidanceChatSessionDocument>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: "GuidanceSubmission",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messages: { type: [chatMessageSchema], default: [] },
    totalMessageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Unique: one chat thread per (submission, user)
guidanceChatSessionSchema.index(
  { submissionId: 1, userId: 1 },
  { unique: true },
);

export const GuidanceChatSession = mongoose.model<GuidanceChatSessionDocument>(
  "GuidanceChatSession",
  guidanceChatSessionSchema,
);
