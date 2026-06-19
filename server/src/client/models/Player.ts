import mongoose, { Document, Schema } from "mongoose";

export interface PlayerDocument extends Document {
  userId: mongoose.Types.ObjectId; // Master User who owns this profile
  type: "SELF" | "DEPENDENT";
  name: string;
  age?: number;
  dob?: Date;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sportsFocus: string[];
  skillLevel?: string;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Health" | "Social" | "Competitive";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  paymentHistory?: Array<{
    bookingId: mongoose.Types.ObjectId;
    amount: number;
    date: Date;
  }>;
  pathwayState?: {
    satisfiedPrerequisites?: string[];
    currentGpa?: number;
    targetDivision?: string;
    graduationYear?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<PlayerDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["SELF", "DEPENDENT"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
    },
    dob: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
    },
    relation: {
      type: String,
    },
    sportsFocus: {
      type: [String],
      default: [],
    },
    skillLevel: {
      type: String,
    },
    personalityTags: {
      type: [String],
    },
    primaryObjective: {
      type: String,
      enum: ["Recreational", "Health", "Social", "Competitive"],
    },
    weeklyTimeCommitment: {
      type: Number,
    },
    budgetTier: {
      type: String,
      enum: ["Budget", "Moderate", "Premium"],
    },
    paymentHistory: [
      {
        bookingId: {
          type: Schema.Types.ObjectId,
          ref: "Booking",
        },
        amount: Number,
        date: Date,
      },
    ],
    pathwayState: {
      satisfiedPrerequisites: { type: [String], default: [] },
      currentGpa: { type: Number, min: 0, max: 4.0 },
      targetDivision: { type: String },
      graduationYear: { type: Number },
    },
  },
  { timestamps: true }
);

export const Player = mongoose.model<PlayerDocument>("Player", playerSchema);
