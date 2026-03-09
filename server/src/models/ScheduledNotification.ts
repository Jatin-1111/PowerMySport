import mongoose, { Document, Schema } from "mongoose";

export type ReminderType = "BOOKING_REMINDER";
export type ReminderInterval = "24_HOURS" | "1_HOUR" | "15_MINUTES";
export type ScheduledNotificationStatus =
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "CANCELLED";

export interface ScheduledNotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type: ReminderType;
  interval: ReminderInterval;
  scheduledFor: Date;
  status: ScheduledNotificationStatus;

  // Related entity
  bookingId?: mongoose.Types.ObjectId;

  // Notification payload
  title: string;
  body: string;
  data?: Record<string, any>;

  // Delivery channels
  channels: {
    email?: boolean;
    push?: boolean;
    inApp?: boolean;
  };

  // Tracking
  sentAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const scheduledNotificationSchema = new Schema<ScheduledNotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["BOOKING_REMINDER"],
      required: true,
      default: "BOOKING_REMINDER",
    },
    interval: {
      type: String,
      enum: ["24_HOURS", "1_HOUR", "15_MINUTES"],
      required: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    channels: {
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      inApp: { type: Boolean, default: false },
    },
    sentAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

// Compound index for efficient queries
scheduledNotificationSchema.index({ status: 1, scheduledFor: 1 });
scheduledNotificationSchema.index({ bookingId: 1, interval: 1 });
scheduledNotificationSchema.index({ userId: 1, type: 1, status: 1 });

// TTL index to auto-delete old sent notifications after 30 days
scheduledNotificationSchema.index(
  { sentAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
    partialFilterExpression: { status: "SENT" },
  },
);

export const ScheduledNotification =
  mongoose.model<ScheduledNotificationDocument>(
    "ScheduledNotification",
    scheduledNotificationSchema,
  );
