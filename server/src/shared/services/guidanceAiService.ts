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

export const journeyPhaseSchema = z.object({
  title: z.string(),
  timeframe: z.string(),
  focus: z.string(),
  milestones: z.array(z.string()),
  outcome: z.string(),
  estimatedCost: z.string().optional(),
  pathwayLevel: z.number().int().min(1).max(5).optional(),
});

export const goalAssessmentSchema = z.object({
  statedGoal: z.string(),
  verdict: z.enum(["On Track", "Achievable", "Ambitious", "Long-Term"]),
  rationale: z.string(),
  benchmark: z.string(),
});

export const costBreakdownSchema = z.object({
  monthlyCoaching: z.string(),
  equipment: z.string(),
  tournaments: z.string(),
  summary: z.string(),
});

export const guidanceResponseSchema = z.object({
  profileAnalysis: z.string(),
  idealCoachingStyle: z.string(),
  weeklyBlueprint: z.object({
    trainingHours: z.string(),
    freePlayHours: z.string(),
    restDays: z.string(),
  }),
  recommendedPlatformActions: z.union([z.string(), z.array(z.string())]).transform((v) => Array.isArray(v) ? v.join(". ") : v),
  recommendedSports: z.array(z.string()).optional(),
  mentalSkillsRoadmap: z
    .object({
      currentFocus: z.string(),
      skills: z.array(
        z.object({ skill: z.string(), howToDevelop: z.string() }),
      ),
    })
    .optional(),
  talentIdentifiers: z.array(z.string()).optional(),
  multiSportAdvisory: z.string().optional(),
  journeyPhases: z.array(journeyPhaseSchema).optional(),
  goalAssessment: goalAssessmentSchema.optional(),
  costBreakdown: costBreakdownSchema.optional(),
  // Server-computed — not from AI, added in controller
  burnoutRisk: burnoutRiskSchema.optional(),
});

export type GuidanceRequest = z.infer<typeof guidanceRequestSchema>;
export type GuidanceResponse = z.infer<typeof guidanceResponseSchema>;

export const getYouthSportsGuidanceSystemPrompt = (
  hasSport: boolean,
  age: number,
) => `You are an expert Youth Sports Consultant advising an Indian parent. You will receive a child's profile strictly in JSON format. ${
  hasSport
    ? 'The profile includes a specific "sport". Focus your analysis on how to progress in that sport. Do NOT include "recommendedSports" in your response.'
    : 'The profile has NO specific sport. Recommend the top 3 sports that best fit the child based on personality, goals, age, and fitness. Include these in the "recommendedSports" array.'
}
Always include a "journeyPhases" plan: a sequential, time-bound roadmap of 4-6 phases that moves the child from their current level toward their goal. If the parent's question names a specific target (e.g. a ranking, a tournament level, or a timeframe like "6 months"), the phases MUST be tailored to reach that exact target and the timeframes MUST add up to it. Each phase builds on the previous one and reads like a clear, motivating roadmap a parent can follow.
Always include "goalAssessment": directly and HONESTLY answer the parent's specific question (parent_specific_question) and judge how realistic their goal is for THIS child in the stated timeframe — never blindly optimistic. Ground it with a concrete benchmark (what players/children at the target level typically do).
Always include "costBreakdown" and an "estimatedCost" on every phase: all money MUST be in Indian Rupees (₹), scaled to the child's "budget_tier" and "location" (an Indian state). Give realistic ranges and make clear these are indicative figures that vary by city and academy — do NOT invent precise prices.
For each phase include "pathwayLevel": a number 1–5 indicating which sports pathway level this phase targets (1=Grassroots, 2=District, 3=State, 4=National, 5=International). Use current_pathway_level as the anchor for Phase 1 if provided.
Return ONLY a valid JSON object — no markdown, no preamble — matching this schema exactly:
{
  "profileAnalysis": "2-3 sentences: how this child's specific profile (personality, fitness, age, goals) positions them for sport",
  "idealCoachingStyle": "Specific description of the coaching style and communication approach that fits this child's personality and age — what to look for when hiring",
  "weeklyBlueprint": {
    "trainingHours": "Specific hours per week for structured training",
    "freePlayHours": "Hours per week for unstructured free play",
    "restDays": "How many rest days and why"
  },
  "recommendedPlatformActions": "Single string (not array) containing 3-4 specific next steps the parent should take on the platform to get started",${
    hasSport
      ? ""
      : '\n  "recommendedSports": ["Sport 1", "Sport 2", "Sport 3"],'
  }
  "journeyPhases": [
    {
      "title": "Short, motivating phase name (e.g. 'Lock In the Fundamentals')",
      "timeframe": "Time window for this phase (e.g. 'Weeks 1-4' or 'Month 1-2')",
      "focus": "One sentence on what this phase is about and why it matters now",
      "milestones": ["2-4 concrete, checkable actions or checkpoints the parent/child completes in this phase — specific to the sport, age, and goal"],
      "outcome": "What the child will have achieved or be able to do by the end of this phase",
      "estimatedCost": "Indicative INR cost for this phase incl. coaching and any gear/tournaments (e.g. '₹10,000–15,000')",
      "pathwayLevel": 1
    }
  ],
  "goalAssessment": {
    "statedGoal": "Restate the parent's goal in one clear line — use parent_specific_question if present, else the primary objective",
    "verdict": "Exactly one of: On Track | Achievable | Ambitious | Long-Term — your honest read of how realistic the goal is in the stated timeframe",
    "rationale": "1-2 sentences directly answering the parent's question and justifying the verdict for THIS child's age, level and time commitment",
    "benchmark": "A concrete reference point — what children/players at the target level typically do (e.g. training hours, tournaments per season, realistic timeline) so the parent has an honest yardstick"
  },
  "costBreakdown": {
    "monthlyCoaching": "Indicative monthly coaching cost range in INR for this budget_tier and location (e.g. '₹6,000–10,000/month')",
    "equipment": "Indicative equipment & gear cost range in INR (one-time/seasonal)",
    "tournaments": "Indicative cost range in INR for tournament entries + travel across the plan period",
    "summary": "One honest sentence on the overall financial commitment; state that figures are indicative and vary by city and academy"
  },
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
  "gemini-3.1-flash-lite",
  "gemini-2.5",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
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
          systemInstruction: getYouthSportsGuidanceSystemPrompt(
            !!payload.sport,
            payload.child_age,
          ),
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
