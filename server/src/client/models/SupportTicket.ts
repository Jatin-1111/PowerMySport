import mongoose, { Document, Schema } from "mongoose";

export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type SupportTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface SupportTicketDocument extends Document {
  userId?: mongoose.Types.ObjectId | null;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requesterType?: "player" | "venue_owner" | "coach" | "academy_owner" | "other";
  subject: string;
  description: string;
  category: "BOOKING" | "PAYMENT" | "ACCOUNT" | "TECHNICAL" | "OTHER";
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assignedAdminId?: mongoose.Types.ObjectId;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  notes: Array<{
    authorType: "USER" | "Admin";
    authorId: mongoose.Types.ObjectId;
    message: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<SupportTicketDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    requesterName: {
      type: String,
      trim: true,
    },
    requesterEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    requesterPhone: {
      type: String,
      trim: true,
    },
    requesterType: {
      type: String,
      enum: ["player", "venue_owner", "coach", "academy_owner", "other"],
      default: "other",
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      enum: ["BOOKING", "PAYMENT", "ACCOUNT", "TECHNICAL", "OTHER"],
      default: "OTHER",
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true,
    },
    assignedAdminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    notes: [
      {
        authorType: {
          type: String,
          enum: ["USER", "Admin"],
          required: true,
        },
        authorId: {
          type: Schema.Types.ObjectId,
          required: true,
        },
        message: {
          type: String,
          required: true,
          trim: true,
          maxlength: 1000,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

supportTicketSchema.index({ createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: -1, updatedAt: -1 });

// Backs getMySupportTickets' "my tickets" list — {userId, status?} + sort
// {updatedAt:-1}. Neither index above has a userId prefix. Two variants
// since `status` is an optional filter there — an unconstrained middle
// field blocks a compound index from serving the sort. Production has
// autoIndex off, so these also need migration 35.
supportTicketSchema.index({ userId: 1, updatedAt: -1 });
supportTicketSchema.index({ userId: 1, status: 1, updatedAt: -1 });

export const SupportTicket = mongoose.model<SupportTicketDocument>(
  "SupportTicket",
  supportTicketSchema
);
