import mongoose, { Document, Schema } from "mongoose";
import {
  type GuidanceRequest,
  type GuidanceResponse,
} from "../../shared/services/guidanceAiService";

export interface GuidanceSubmissionDocument extends Document {
  request: GuidanceRequest;
  response: GuidanceResponse;
  createdAt: Date;
  updatedAt: Date;
}

const guidanceSubmissionSchema = new Schema<GuidanceSubmissionDocument>(
  {
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
        enum: ["Recreational", "Health", "Social", "Competitive"],
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
        required: true,
        trim: true,
        maxlength: 1000,
      },
    },
    response: {
      profileAnalysis: { type: String, required: true },
      topSportRecommendations: {
        type: [
          {
            sport: { type: String, required: true },
            reasonWhy: { type: String, required: true },
          },
        ],
        required: true,
        default: [],
      },
      idealCoachingStyle: { type: String, required: true },
      weeklyBlueprint: {
        trainingHours: { type: String, required: true },
        freePlayHours: { type: String, required: true },
        restDays: { type: String, required: true },
      },
      recommendedPlatformActions: { type: String, required: true },
    },
  },
  { timestamps: true },
);

guidanceSubmissionSchema.index({ createdAt: -1 });

export const GuidanceSubmission = mongoose.model<GuidanceSubmissionDocument>(
  "GuidanceSubmission",
  guidanceSubmissionSchema,
);
