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
  { _id: false },
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
  { timestamps: true },
);

// Non-unique — multiple sessions per user are allowed (a new chat each time
// the assistant is opened, with history to switch back to older ones).
assistantChatSessionSchema.index({ userId: 1 });
assistantChatSessionSchema.index({ userId: 1, updatedAt: -1 });

export const AssistantChatSession = mongoose.model<AssistantChatSessionDocument>(
  "AssistantChatSession",
  assistantChatSessionSchema,
);
