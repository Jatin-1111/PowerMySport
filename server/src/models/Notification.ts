import mongoose, { Document, Model, Schema } from "mongoose";

export type NotificationType =
  | "FRIEND_REQUEST"
  | "FRIEND_REQUEST_ACCEPTED"
  | "FRIEND_REQUEST_DECLINED"
  | "FRIEND_REMOVED"
  | "BOOKING_INVITATION"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_STATUS_UPDATED"
  | "BOOKING_REMINDER"
  | "INVITATION_EXPIRY"
  | "PAYMENT_FAILED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_REFUND"
  | "PAYMENT_SPLIT_RECEIVED"
  | "REVIEW_POSTED"
  | "REVIEW_RESPONSE"
  | "REVIEW_REMINDER"
  | "COACH_VERIFICATION_PENDING"
  | "COACH_VERIFICATION_REVIEW"
  | "COACH_VERIFICATION_VERIFIED"
  | "COACH_VERIFICATION_REJECTED"
  | "VENUE_APPROVAL_PENDING"
  | "VENUE_APPROVAL_APPROVED"
  | "VENUE_APPROVAL_REJECTED"
  | "VENUE_MARKED_FOR_REVIEW"
  | "DISPUTE_FILED"
  | "DISPUTE_RESOLVED"
  | "MESSAGE_RECEIVED";

export type NotificationCategory =
  | "SOCIAL"
  | "BOOKING"
  | "ADMIN"
  | "REVIEW"
  | "PAYMENT"
  | "COMMUNITY";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
  deletedAt?: Date;
}

// Query helpers interface
interface NotificationQueryHelpers {
  active(
    this: mongoose.Query<any, any, NotificationQueryHelpers>,
  ): mongoose.Query<any, any, NotificationQueryHelpers>;
}

const notificationSchema = new Schema<
  INotification,
  {},
  {},
  NotificationQueryHelpers
>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "FRIEND_REQUEST",
        "FRIEND_REQUEST_ACCEPTED",
        "FRIEND_REQUEST_DECLINED",
        "FRIEND_REMOVED",
        "BOOKING_INVITATION",
        "BOOKING_CONFIRMED",
        "BOOKING_CANCELLED",
        "BOOKING_STATUS_UPDATED",
        "BOOKING_REMINDER",
        "INVITATION_EXPIRY",
        "PAYMENT_FAILED",
        "PAYMENT_CONFIRMED",
        "PAYMENT_REFUND",
        "PAYMENT_SPLIT_RECEIVED",
        "REVIEW_POSTED",
        "REVIEW_RESPONSE",
        "REVIEW_REMINDER",
        "COACH_VERIFICATION_PENDING",
        "COACH_VERIFICATION_REVIEW",
        "COACH_VERIFICATION_VERIFIED",
        "COACH_VERIFICATION_REJECTED",
        "VENUE_APPROVAL_PENDING",
        "VENUE_APPROVAL_APPROVED",
        "VENUE_APPROVAL_REJECTED",
        "VENUE_MARKED_FOR_REVIEW",
        "DISPUTE_FILED",
        "DISPUTE_RESOLVED",
        "MESSAGE_RECEIVED",
      ],
      required: true,
    },
    category: {
      type: String,
      enum: ["SOCIAL", "BOOKING", "ADMIN", "REVIEW", "PAYMENT", "COMMUNITY"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from creation
      // Don't add index: true here - we define a TTL index below
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Soft delete query helper
notificationSchema.query.active = function (
  this: mongoose.Query<any, any, NotificationQueryHelpers>,
) {
  return this.where({ deletedAt: null });
};

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;
