import mongoose, { Document, Schema } from "mongoose";
import { ChatMessage } from "./GuidanceChatSession";

export interface RoadmapChatSessionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  sportSlug: string;
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
    messages: { type: [chatMessageSchema], default: [] },
    totalMessageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// One running conversation per (user, sport) — spans every level of that sport
roadmapChatSessionSchema.index({ userId: 1, sportSlug: 1 }, { unique: true });

export const RoadmapChatSession = mongoose.model<RoadmapChatSessionDocument>(
  "RoadmapChatSession",
  roadmapChatSessionSchema,
);
