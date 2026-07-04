import mongoose, { Document, Schema } from "mongoose";
import {
  type GuidanceRequest,
  type GuidanceResponse,
} from "../../shared/services/guidanceAiService";

export interface GuidanceSubmissionDocument extends Document {
  userId?: mongoose.Types.ObjectId;
  request: GuidanceRequest;
  response: GuidanceResponse;
  createdAt: Date;
  updatedAt: Date;
}

const guidanceSubmissionSchema = new Schema<GuidanceSubmissionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    request: {
      child_age: { type: Number, required: true, min: 3, max: 21 },
      child_gender: {
        type: String,
        required: true,
        enum: ["male", "female"],
        trim: true,
      },
      current_fitness_level: {
        type: String,
        required: true,
        enum: ["Low", "Moderate", "High"],
      },
      personality_tags: { type: [String], default: [] },
      primary_objective: {
        type: String,
        required: true,
        enum: ["Recreational", "Fitness", "Compete", "Elite"],
      },
      weekly_time_commitment: {
        type: Number,
        required: true,
        min: 0,
        max: 40,
      },
      budget_tier: {
        type: String,
        required: true,
        enum: ["Budget", "Moderate", "Premium"],
      },
      parent_specific_question: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      sport: { type: String, trim: true },
      location: { type: String, trim: true },
      current_pathway_level: { type: Number, min: 1, max: 5 },
      years_playing: { type: Number, min: 0, max: 20 },
    },
    response: {
      profileAnalysis: { type: String, required: true },
      idealCoachingStyle: { type: String, required: true },
      weeklyBlueprint: {
        trainingHours: { type: String, required: true },
        freePlayHours: { type: String, required: true },
        restDays: { type: String, required: true },
      },
      recommendedPlatformActions: { type: String, required: true },
      recommendedSports: { type: [String] },
      mentalSkillsRoadmap: {
        currentFocus: { type: String },
        skills: [{ skill: { type: String }, howToDevelop: { type: String }, _id: false }],
      },
      talentIdentifiers: { type: [String] },
      multiSportAdvisory: { type: String },
      journeyPhases: [
        {
          title: { type: String },
          timeframe: { type: String },
          focus: { type: String },
          milestones: { type: [String] },
          outcome: { type: String },
          estimatedCost: { type: String },
          _id: false,
        },
      ],
      goalAssessment: {
        statedGoal: { type: String },
        verdict: {
          type: String,
          enum: ["On Track", "Achievable", "Ambitious", "Long-Term"],
        },
        rationale: { type: String },
        benchmark: { type: String },
      },
      costBreakdown: {
        monthlyCoaching: { type: String },
        equipment: { type: String },
        tournaments: { type: String },
      },
      burnoutRisk: {
        level: { type: String, enum: ["low", "medium", "high"] },
        message: { type: String },
        recommendations: { type: [String] },
      },
    },
  },
  { timestamps: true },
);

guidanceSubmissionSchema.index({ createdAt: -1 });

export const GuidanceSubmission = mongoose.model<GuidanceSubmissionDocument>(
  "GuidanceSubmission",
  guidanceSubmissionSchema,
);
