import mongoose, { Document, Schema } from "mongoose";
import { ChatMessage } from "./GuidanceChatSession";

export interface RoadmapChatSessionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  sportSlug: string;
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

const roadmapChatSessionSchema = new Schema<RoadmapChatSessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sportSlug: { type: String, required: true },
    title: { type: String, default: null },
    messages: { type: [chatMessageSchema], default: [] },
    totalMessageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Non-unique index — multiple sessions per (user, sport) are allowed
roadmapChatSessionSchema.index({ userId: 1, sportSlug: 1 });
roadmapChatSessionSchema.index({ userId: 1, updatedAt: -1 });

export const RoadmapChatSession = mongoose.model<RoadmapChatSessionDocument>(
  "RoadmapChatSession",
  roadmapChatSessionSchema,
);
