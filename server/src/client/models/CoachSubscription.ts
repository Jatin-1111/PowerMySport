import mongoose, { Document, Schema } from "mongoose";
import { notifyUserDataUpdated } from "../sockets/friendSocket";

export type CoachSubscriptionStatus =
  "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";

export interface CoachSubscriptionDocument extends Document {
  id?: string;
  coachId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  dependentId?: mongoose.Types.ObjectId; // Optional dependent for whom this was purchased
  packageId: mongoose.Types.ObjectId; // References CoachSubscriptionPackage
  status: CoachSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  autoRenew: boolean;
  gracePeriodEndsAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const coachSubscriptionSchema = new Schema<CoachSubscriptionDocument>(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
      required: [true, "Coach ID is required"],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    dependentId: {
      type: Schema.Types.ObjectId,
      ref: "Player",
      index: true,
    },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSubscriptionPackage",
      required: [true, "Package ID is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"],
      default: "ACTIVE",
      index: true,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    nextBillingDate: {
      type: Date,
      required: true,
      index: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    gracePeriodEndsAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

coachSubscriptionSchema.virtual("id").get(function (
  this: CoachSubscriptionDocument,
) {
  return this._id.toString();
});

coachSubscriptionSchema.index({ coachId: 1, status: 1 });
coachSubscriptionSchema.index({ userId: 1, status: 1 });

// --- Real-time Auto Updates ---
const notifyUsersOfSubscriptionUpdate = (doc: any) => {
  if (!doc) return;
  if (doc.userId) {
    notifyUserDataUpdated(doc.userId.toString(), "subscription:updated");
  }
  if (doc.coachId) {
    notifyUserDataUpdated(doc.coachId.toString(), "subscription:updated");
  }
};

coachSubscriptionSchema.post("save", function (doc) {
  notifyUsersOfSubscriptionUpdate(doc);
});

coachSubscriptionSchema.post("findOneAndUpdate", function (doc) {
  notifyUsersOfSubscriptionUpdate(doc);
});

export const CoachSubscription = mongoose.model<CoachSubscriptionDocument>(
  "CoachSubscription",
  coachSubscriptionSchema,
);
