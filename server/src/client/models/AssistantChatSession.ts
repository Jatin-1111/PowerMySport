import mongoose, { Document, Schema } from "mongoose";
import { ChatMessage } from "./GuidanceChatSession";

export interface AssistantChatSessionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  title: string | null;
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
  { _id: false }
);

const assistantChatSessionSchema = new Schema<AssistantChatSessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, default: null },
    messages: { type: [chatMessageSchema], default: [] },
    totalMessageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Non-unique — multiple sessions per user are allowed (a new chat each time
// the assistant is opened, with history to switch back to older ones).
assistantChatSessionSchema.index({ userId: 1 });
assistantChatSessionSchema.index({ userId: 1, updatedAt: -1 });
// Retention: chats expire through a TTL index on `updatedAt` created by
// migration 55, deliberately NOT declared here. An index on the model is created
// by any local run with autoIndex on, in whatever database it points at, which
// here is production. See the migration for the period and why.

export const AssistantChatSession = mongoose.model<AssistantChatSessionDocument>(
  "AssistantChatSession",
  assistantChatSessionSchema
);
