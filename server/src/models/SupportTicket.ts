import mongoose, { Document, Schema } from "mongoose";

export type SupportTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export type SupportTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface SupportTicketDocument extends Document {
  userId: mongoose.Types.ObjectId;
  subject: string;
  description: string;
  category: "BOOKING" | "PAYMENT" | "ACCOUNT" | "TECHNICAL" | "OTHER";
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assignedAdminId?: mongoose.Types.ObjectId;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  notes: Array<{
    authorType: "USER" | "ADMIN";
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
      required: true,
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
          enum: ["USER", "ADMIN"],
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
  { timestamps: true },
);

supportTicketSchema.index({ createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: -1, updatedAt: -1 });

export const SupportTicket = mongoose.model<SupportTicketDocument>(
  "SupportTicket",
  supportTicketSchema,
);
