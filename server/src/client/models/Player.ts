import mongoose, { Document, Schema } from "mongoose";

/**
 * What a parent told the sport-matching quiz about their child. These are the
 * quiz's inputs, not facts about the child, so they live together and are replaced
 * as a set when the quiz is retaken, instead of being edited one by one.
 */
export interface QuizAnswers {
  heightCm?: number;
  weightKg?: number;
  energyType?: "explosive" | "endurance";
  motorType?: "gross" | "fine";
  visualTracking?: "strong" | "moderate" | "weak";
  eyesight?: "sharp" | "corrected" | "limited";
  agility?: "high" | "moderate" | "low";
  teamIndividual?: number; // 1=very individual, 5=very team
  competitiveResponse?: "fired-up" | "calm" | "discouraged";
  focusStyle?: "bursts" | "sustained";
  decisionStyle?: "react" | "strategic";
  pressureResponse?: "thrives" | "manages" | "avoids";
  repetitionTolerance?: "high" | "low";
  contactComfort?: "loves" | "neutral" | "avoids";
  environment?: "outdoor" | "indoor" | "no-preference";
  waterComfort?: "comfortable" | "neutral" | "uncomfortable";
}

const quizSchema = new Schema<QuizAnswers>(
  {
    heightCm: { type: Number, min: 50, max: 250 },
    weightKg: { type: Number, min: 10, max: 200 },
    energyType: { type: String, enum: ["explosive", "endurance"] },
    motorType: { type: String, enum: ["gross", "fine"] },
    visualTracking: { type: String, enum: ["strong", "moderate", "weak"] },
    eyesight: { type: String, enum: ["sharp", "corrected", "limited"] },
    agility: { type: String, enum: ["high", "moderate", "low"] },
    teamIndividual: { type: Number, min: 1, max: 5 },
    competitiveResponse: { type: String, enum: ["fired-up", "calm", "discouraged"] },
    focusStyle: { type: String, enum: ["bursts", "sustained"] },
    decisionStyle: { type: String, enum: ["react", "strategic"] },
    pressureResponse: { type: String, enum: ["thrives", "manages", "avoids"] },
    repetitionTolerance: { type: String, enum: ["high", "low"] },
    contactComfort: { type: String, enum: ["loves", "neutral", "avoids"] },
    environment: { type: String, enum: ["outdoor", "indoor", "no-preference"] },
    waterComfort: { type: String, enum: ["comfortable", "neutral", "uncomfortable"] },
  },
  { _id: false }
);

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
  /** The sport-matching quiz's own answers; see QuizAnswers. Merged on each save; a retake overwrites every answer. */
  quiz?: QuizAnswers;
  // Wizard practical (finer-grained than budgetTier)
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  ambition?: "fun" | "competitive" | "national" | "career" | "professional";
  weeklyHoursCategory?: "1-3" | "4-7" | "8-12" | "13-plus";
  experienceLevel?: "beginner" | "intermediate" | "competitive";
  trainingType?: "self" | "club" | "academy" | "private";
  /** Sports the parent shortlisted themselves in the assessment (max 3). */
  consideringSports?: string[];
  // Build-the-profile: current standing / track record
  currentStandingTier?: number; // 1–5, archetype-aware ladder (see client sportArchetypes.ts)
  wizardCity?: string; // city picked in wizard (location holds state)
  // Wizard results
  sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
  wizardCompletedAt?: Date;
  /**
   * The sport the parent explicitly committed to on the results page. Distinct
   * from `consideringSports` (what they shortlisted going in) and from the
   * top `sportMatches` entry (what we scored highest) — this is the only field
   * that records a decision rather than an input or an inference.
   */
  chosenSport?: string;
  chosenSportAt?: Date;
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
    quiz: { type: quizSchema, default: undefined },
    // Wizard practical
    budgetRange: { type: String, enum: ["under-3k", "3k-7k", "7k-15k", "15k-plus"] },
    // "professional" is retained for rows written before "career" replaced it
    // as the top visible option — the wizard no longer offers it.
    ambition: { type: String, enum: ["fun", "competitive", "national", "career", "professional"] },
    weeklyHoursCategory: { type: String, enum: ["1-3", "4-7", "8-12", "13-plus"] },
    experienceLevel: { type: String, enum: ["beginner", "intermediate", "competitive"] },
    trainingType: { type: String, enum: ["self", "club", "academy", "private"] },
    consideringSports: { type: [String], default: [] },
    // Build-the-profile: current standing / track record
    currentStandingTier: { type: Number, min: 1, max: 5 },
    wizardCity: { type: String, trim: true },
    sportMatches: [{ sport: String, fitLabel: String, score: Number }],
    wizardCompletedAt: { type: Date },
    chosenSport: { type: String, trim: true },
    chosenSportAt: { type: Date },
  },
  { timestamps: true }
);

export const Player = mongoose.model<PlayerDocument>("Player", playerSchema);
