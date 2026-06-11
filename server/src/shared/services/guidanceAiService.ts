import { GoogleGenerativeAI } from "@google/generative-ai";
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
  parent_specific_question: z.string().trim().min(1).max(1000),
});

export const guidanceResponseSchema = z.object({
  profileAnalysis: z.string(),
  topSportRecommendations: z.array(
    z.object({
      sport: z.string(),
      reasonWhy: z.string(),
    }),
  ),
  idealCoachingStyle: z.string(),
  weeklyBlueprint: z.object({
    trainingHours: z.string(),
    freePlayHours: z.string(),
    restDays: z.string(),
  }),
  recommendedPlatformActions: z.string(),
});

export type GuidanceRequest = z.infer<typeof guidanceRequestSchema>;
export type GuidanceResponse = z.infer<typeof guidanceResponseSchema>;

export const YOUTH_SPORTS_GUIDANCE_SYSTEM_PROMPT = `You are an expert Youth Sports Consultant. You will receive a child's profile strictly in JSON format. You must analyze this data and return your absolute final response strictly as a JSON object matching this schema blueprint, without any markdown wrappers or conversational preamble before or after the JSON structure:
{
  "profileAnalysis": "String summarizing how their profile attributes match up",
  "topSportRecommendations": [
    { "sport": "String", "reasonWhy": "String matching child personality/fitness" }
  ],
  "idealCoachingStyle": "String describing what kind of coach profile to look for on our platform",
  "weeklyBlueprint": { "trainingHours": "String", "freePlayHours": "String", "restDays": "String" },
  "recommendedPlatformActions": "Specific actionable next steps on what to book first on our site"
}`;

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const configuredModelName = process.env.GEMINI_MODEL_NAME?.trim();
const guidanceModelCandidates = [
  configuredModelName,
  "gemini-3.5-flash",
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

  return new GoogleGenerativeAI(apiKey);
};

export const generateYouthSportsGuidance = async (
  payload: GuidanceRequest,
): Promise<GuidanceResponse> => {
  const genAI = getGuidanceClient();
  let lastError: unknown = null;
  let sawQuotaIssue = false;

  for (const modelName of guidanceModelCandidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: YOUTH_SPORTS_GUIDANCE_SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      });

      const response = await model.generateContent(JSON.stringify(payload));
      const rawText = response.response.text().trim();

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
