import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const guidanceRequestSchema = z.object({
  child_age: z.number().int().min(3).max(21),
  child_gender: z.enum(["male", "female"]),
  current_fitness_level: z.enum(["Low", "Moderate", "High"]),
  personality_tags: z.array(z.string().trim().min(1)).default([]),
  primary_objective: z.enum([
    "Recreational",
    "Health",
    "Social",
    "Competitive",
  ]),
  weekly_time_commitment: z.number().min(0).max(40),
  budget_tier: z.enum(["Budget", "Moderate", "Premium"]),
  parent_specific_question: z.string().trim().max(1000).optional(),
  sport: z.string().trim().optional(),
  location: z.string().trim().max(80).optional(), // Indian state for local scheme recommendations
  current_pathway_level: z.number().int().min(1).max(5).optional(),
});

export const burnoutRiskSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  message: z.string(),
  recommendations: z.array(z.string()),
});

export const guidanceResponseSchema = z.object({
  profileAnalysis: z.string(),
  idealCoachingStyle: z.string(),
  weeklyBlueprint: z.object({
    trainingHours: z.string(),
    freePlayHours: z.string(),
    restDays: z.string(),
  }),
  recommendedPlatformActions: z.string(),
  recommendedSports: z.array(z.string()).optional(),
  mentalSkillsRoadmap: z.object({
    currentFocus: z.string(),
    skills: z.array(z.object({ skill: z.string(), howToDevelop: z.string() })),
  }).optional(),
  talentIdentifiers: z.array(z.string()).optional(),
  multiSportAdvisory: z.string().optional(),
  // Server-computed — not from AI, added in controller
  burnoutRisk: burnoutRiskSchema.optional(),
});

export type GuidanceRequest = z.infer<typeof guidanceRequestSchema>;
export type GuidanceResponse = z.infer<typeof guidanceResponseSchema>;

export const getYouthSportsGuidanceSystemPrompt = (hasSport: boolean, age: number) => `You are an expert Youth Sports Consultant advising an Indian parent. You will receive a child's profile strictly in JSON format. ${
  hasSport
    ? 'The profile includes a specific "sport". Focus your analysis on how to progress in that sport. Do NOT include "recommendedSports" in your response.'
    : "The profile has NO specific sport. Recommend the top 3 sports that best fit the child based on personality, goals, age, and fitness. Include these in the \"recommendedSports\" array."
}
Return ONLY a valid JSON object — no markdown, no preamble — matching this schema exactly:
{
  "profileAnalysis": "2-3 sentences: how this child's specific profile (personality, fitness, age, goals) positions them for sport",
  "idealCoachingStyle": "Specific description of the coaching style and communication approach that fits this child's personality and age — what to look for when hiring",
  "weeklyBlueprint": {
    "trainingHours": "Specific hours per week for structured training",
    "freePlayHours": "Hours per week for unstructured free play",
    "restDays": "How many rest days and why"
  },
  "recommendedPlatformActions": "3-4 specific next steps the parent should take on the platform to get started",${
    hasSport ? "" : '\n  "recommendedSports": ["Sport 1", "Sport 2", "Sport 3"],'
  }
  "mentalSkillsRoadmap": {
    "currentFocus": "The single most important mental skill for this child to develop right now given their age and objective",
    "skills": [
      {"skill": "Mental skill name", "howToDevelop": "Concrete, age-appropriate exercise or drill to build this skill"}
    ]
  },
  "talentIdentifiers": ["Observable sign or marker that this child shows genuine aptitude — specific to the sport and age group"],${
    age <= 11
      ? '\n  "multiSportAdvisory": "Explain in 2-3 sentences why playing multiple sports (not specialising yet) is scientifically recommended for children under 12, with specific benefits for this child\'s profile and which complementary sports to consider",'
      : ""
  }
}`;
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const configuredModelName = process.env.GEMINI_MODEL_NAME?.trim();
const guidanceModelCandidates = [
  configuredModelName,
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
].filter((modelName): modelName is string => Boolean(modelName));

const isModelUnavailableError = (errorMessage: string) =>
  errorMessage.includes("404") || errorMessage.includes("not found");

const isQuotaOrRateLimitError = (errorMessage: string) =>
  errorMessage.includes("429") ||
  errorMessage.includes("quota") ||
  errorMessage.includes("rate limit") ||
  errorMessage.includes("too many requests");

const getGuidanceClient = () => {
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY or GOOGLE_API_KEY environment variable",
    );
  }

  return new GoogleGenAI({ apiKey });
};

export const generateYouthSportsGuidance = async (
  payload: GuidanceRequest,
): Promise<GuidanceResponse> => {
  const genAI = getGuidanceClient();
  let lastError: unknown = null;
  let sawQuotaIssue = false;

  for (const modelName of guidanceModelCandidates) {
    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: JSON.stringify(payload),
        config: {
          systemInstruction: getYouthSportsGuidanceSystemPrompt(!!payload.sport, payload.child_age),
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      });

      const rawText = (response.text ?? "").trim();

      if (!rawText) {
        throw new Error("LLM returned an empty guidance response");
      }

      const parsed = JSON.parse(rawText) as unknown;
      return guidanceResponseSchema.parse(parsed);
    } catch (error) {
      lastError = error;

      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : "";

      if (isQuotaOrRateLimitError(errorMessage)) {
        sawQuotaIssue = true;
        continue;
      }

      if (!isModelUnavailableError(errorMessage)) {
        throw error;
      }
    }
  }

  if (sawQuotaIssue) {
    throw new Error(
      "Guidance generation is temporarily unavailable because Gemini API quota was exceeded for all configured models. Please wait a minute, reduce request volume, or switch GEMINI_MODEL_NAME / API key to one with available quota.",
    );
  }

  throw new Error(
    `No supported Gemini guidance model found. Tried: ${guidanceModelCandidates.join(
      ", ",
    )}. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
};
