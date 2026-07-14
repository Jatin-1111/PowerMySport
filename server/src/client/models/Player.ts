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
  location?: string; // Indian state
  heightCm?: number;
  weightKg?: number;
  medicalConditions?: string[];
  // Wizard physical
  build?: "lean" | "average" | "stocky";
  heightCategory?: "short" | "average" | "tall";
  energyType?: "explosive" | "endurance";
  motorType?: "gross" | "fine";
  visualTracking?: "strong" | "moderate" | "weak";
  // Wizard personality
  teamIndividual?: number; // 1=very individual, 5=very team
  competitiveResponse?: "fired-up" | "calm" | "discouraged";
  focusStyle?: "bursts" | "sustained";
  decisionStyle?: "react" | "strategic";
  pressureResponse?: "thrives" | "manages" | "avoids";
  repetitionTolerance?: "high" | "low";
  // Wizard comfort
  contactComfort?: "loves" | "neutral" | "avoids";
  environment?: "outdoor" | "indoor" | "no-preference";
  waterComfort?: "comfortable" | "neutral" | "uncomfortable";
  // Wizard practical (finer-grained than budgetTier)
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  ambition?: "fun" | "competitive" | "national" | "professional";
  eyesight?: "sharp" | "corrected" | "limited";
  agility?: "high" | "moderate" | "low";
  weeklyHoursCategory?: "1-3" | "4-7" | "8-12" | "13-plus";
  wizardCity?: string; // city picked in wizard (location holds state)
  // Wizard results
  sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
  wizardCompletedAt?: Date;
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
    // Wizard physical
    build: { type: String, enum: ["lean", "average", "stocky"] },
    heightCategory: { type: String, enum: ["short", "average", "tall"] },
    energyType: { type: String, enum: ["explosive", "endurance"] },
    motorType: { type: String, enum: ["gross", "fine"] },
    visualTracking: { type: String, enum: ["strong", "moderate", "weak"] },
    // Wizard personality
    teamIndividual: { type: Number, min: 1, max: 5 },
    competitiveResponse: { type: String, enum: ["fired-up", "calm", "discouraged"] },
    focusStyle: { type: String, enum: ["bursts", "sustained"] },
    decisionStyle: { type: String, enum: ["react", "strategic"] },
    pressureResponse: { type: String, enum: ["thrives", "manages", "avoids"] },
    repetitionTolerance: { type: String, enum: ["high", "low"] },
    // Wizard comfort
    contactComfort: { type: String, enum: ["loves", "neutral", "avoids"] },
    environment: { type: String, enum: ["outdoor", "indoor", "no-preference"] },
    waterComfort: { type: String, enum: ["comfortable", "neutral", "uncomfortable"] },
    // Wizard practical
    budgetRange: { type: String, enum: ["under-3k", "3k-7k", "7k-15k", "15k-plus"] },
    ambition: { type: String, enum: ["fun", "competitive", "national", "professional"] },
    eyesight: { type: String, enum: ["sharp", "corrected", "limited"] },
    agility: { type: String, enum: ["high", "moderate", "low"] },
    weeklyHoursCategory: { type: String, enum: ["1-3", "4-7", "8-12", "13-plus"] },
    wizardCity: { type: String, trim: true },
    sportMatches: [{ sport: String, fitLabel: String, score: Number }],
    wizardCompletedAt: { type: Date },
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
