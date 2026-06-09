import mongoose, { Document, Schema } from "mongoose";

export type CoachSubscriptionOverrideStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface CoachSubscriptionOverrideRequestDocument extends Document {
  id?: string;
  coachId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  currentPlanId?: mongoose.Types.ObjectId | null;
  requestedPlanId?: mongoose.Types.ObjectId | null;
  note: string;
  status: CoachSubscriptionOverrideStatus;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const coachSubscriptionOverrideRequestSchema =
  new Schema<CoachSubscriptionOverrideRequestDocument>(
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
      currentPlanId: {
        type: Schema.Types.ObjectId,
        ref: "CoachPlan",
        default: null,
      },
      requestedPlanId: {
        type: Schema.Types.ObjectId,
        ref: "CoachPlan",
        default: null,
      },
      note: {
        type: String,
        required: [true, "Override request note is required"],
        trim: true,
      },
      status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: "PENDING",
        index: true,
      },
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewNote: {
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

coachSubscriptionOverrideRequestSchema.virtual("id").get(function (
  this: CoachSubscriptionOverrideRequestDocument,
) {
  return this._id.toString();
});

coachSubscriptionOverrideRequestSchema.index({
  coachId: 1,
  status: 1,
  createdAt: -1,
});

export const CoachSubscriptionOverrideRequest =
  mongoose.model<CoachSubscriptionOverrideRequestDocument>(
    "CoachSubscriptionOverrideRequest",
    coachSubscriptionOverrideRequestSchema,
  );
