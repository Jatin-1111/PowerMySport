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
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
  heightCm?: number;
  weightKg?: number;
  medicalConditions?: string[];
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
    yearsPlaying: {
      type: Number,
      min: 0,
      max: 20,
    },
    personalityTags: {
      type: [String],
    },
    primaryObjective: {
      type: String,
      enum: ["Recreational", "Fitness", "Compete"],
    },
    weeklyTimeCommitment: {
      type: Number,
    },
    budgetTier: {
      type: String,
      enum: ["Budget", "Moderate", "Premium"],
    },
    location: {
      type: String,
      trim: true,
    },
    heightCm: { type: Number, min: 50, max: 250 },
    weightKg: { type: Number, min: 10, max: 200 },
    medicalConditions: { type: [String], default: [] },
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
  { timestamps: true },
);

export const Player = mongoose.model<PlayerDocument>("Player", playerSchema);
