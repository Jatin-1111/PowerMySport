import mongoose, { Document, Schema } from "mongoose";
import { ChatMessage } from "./GuidanceChatSession";

/**
 * One rolling conversation per WhatsApp number.
 *
 * The number itself is never stored: `phoneHash` is a keyed hash (see
 * `hashPhone`), enough to recognise the same parent next time and to cap their
 * daily messages, but not reversible to a phone number if this collection
 * leaks. The reply is addressed from the number on the inbound webhook, so
 * nothing here needs the raw value.
 */
export interface WhatsAppConversationDocument extends Document {
  phoneHash: string;
  /** Only the most recent turns are kept; older ones add cost and no context worth having. */
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

const whatsAppConversationSchema = new Schema<WhatsAppConversationDocument>(
  {
    phoneHash: { type: String, required: true, unique: true },
    messages: { type: [chatMessageSchema], default: [] },
    totalMessageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// A child's sport, age and goals are being typed into this chat, so it is not
// kept indefinitely: 90 days after the last message the conversation is gone.
whatsAppConversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const WhatsAppConversation = mongoose.model<WhatsAppConversationDocument>(
  "WhatsAppConversation",
  whatsAppConversationSchema
);
