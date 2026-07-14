import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { SportPathway } from "../models/SportPathway";
import { SportBasePath } from "../models/SportBasePath";
import { SportStatePath } from "../models/SportStatePath";

export const guidanceRequestSchema = z.object({
  child_age: z.number().int().min(3).max(21),
  child_gender: z.enum(["male", "female"]),
  current_fitness_level: z.enum(["Low", "Moderate", "High"]),
  personality_tags: z.array(z.string().trim().min(1)).default([]),
  primary_objective: z.enum(["Recreational", "Fitness", "Compete", "Elite"]),
  weekly_time_commitment: z.number().min(0).max(40),
  budget_tier: z.enum(["Budget", "Moderate", "Premium"]),
  parent_specific_question: z.string().trim().max(1000).optional(),
  sport: z.string().trim().optional(),
  location: z.string().trim().max(80).optional(), // Indian state for local scheme recommendations
  current_pathway_level: z.number().int().min(1).max(5).optional(),
  // How long the child has already been playing this sport, in years (0 = brand new). Distinct from
  // current_pathway_level: a child can have played casually for 2 years while still being new to a
  // specific formal tier — this tells the AI how much raw time-in-sport to assume, e.g. for injury
  // risk, technique habits already formed, and how aggressive a timeline is realistic.
  years_playing: z.number().min(0).max(20).optional(),
  // Parent context — optional fields collected in the onboarding step
  parent_bio: z.string().trim().max(300).optional(),
  parent_sport_interest: z.array(z.string().trim()).optional(),
  parent_involvement_years: z.number().min(0).max(40).optional(),
  // Wizard assessment signals — physical and psychological profile from the sport-finder wizard
  wizard_build: z.enum(["lean", "average", "stocky"]).optional(),
  wizard_height: z.enum(["short", "average", "tall"]).optional(),
  wizard_energy_type: z.enum(["explosive", "endurance"]).optional(),
  wizard_motor_type: z.enum(["gross", "fine"]).optional(),
  wizard_visual_tracking: z.enum(["strong", "moderate", "weak"]).optional(),
  wizard_team_individual: z.number().min(1).max(5).optional(),
  wizard_competitive_response: z.enum(["fired-up", "calm", "discouraged"]).optional(),
  wizard_focus_style: z.enum(["bursts", "sustained"]).optional(),
  wizard_decision_style: z.enum(["react", "strategic"]).optional(),
  wizard_pressure_response: z.enum(["thrives", "manages", "avoids"]).optional(),
  wizard_repetition_tolerance: z.enum(["high", "low"]).optional(),
  wizard_contact_comfort: z.enum(["loves", "neutral", "avoids"]).optional(),
  wizard_environment: z.enum(["outdoor", "indoor", "no-preference"]).optional(),
  wizard_water_comfort: z.enum(["comfortable", "neutral", "uncomfortable"]).optional(),
  wizard_eyesight: z.enum(["sharp", "corrected", "limited"]).optional(),
  wizard_agility: z.enum(["high", "moderate", "low"]).optional(),
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
});

export const guidanceResponseSchema = z.object({
  profileAnalysis: z.string(),
  idealCoachingStyle: z.string(),
  weeklyBlueprint: z.object({
    trainingHours: z.string(),
    freePlayHours: z.string(),
    restDays: z.string(),
  }),
  recommendedPlatformActions: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v.join(". ") : v)),
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
  groundingContext?: string,
  parentContext?: { bio?: string; sportInterests?: string[]; involvementYears?: number },
) => `You are an expert Youth Sports Consultant advising an Indian parent. You will receive a child's profile strictly in JSON format.
${groundingContext ? `\nGROUNDING CONTEXT (OFFICIAL PATHWAY DATA):\n${groundingContext}\n\nYou must anchor your journey phases to these official benchmarks. Do not invent contradictory timelines or criteria.\n` : ""}
WRITE IN THE SIMPLEST POSSIBLE ENGLISH: every field must read like you are speaking out loud to a parent who has never played sport and does not use advanced English. Use only simple, everyday words — prefer short common words over long or formal ones (say "help" not "facilitate", "start" not "commence", "show" not "demonstrate", "use" not "utilize", "enough" not "sufficient"). Use short sentences and active voice. Never use a sport-federation acronym (AITA, ITF, FIDE, SAI, BCCI, WTA, etc.) without immediately explaining it in plain words the first time it appears. Avoid dense, jargon-heavy, or fancy/sophisticated phrasing anywhere in the response — this applies to every field, not just names and acronyms.
If the profile includes wizard assessment fields (wizard_build, wizard_height, wizard_energy_type, wizard_motor_type, wizard_visual_tracking, wizard_team_individual, wizard_competitive_response, wizard_focus_style, wizard_decision_style, wizard_pressure_response, wizard_repetition_tolerance, wizard_contact_comfort, wizard_environment, wizard_water_comfort, wizard_eyesight, wizard_agility), use them to deepen your profileAnalysis and coaching style — they are direct observations about the child's physical build, energy pattern, motor skills, eyesight quality, agility level, and psychological tendencies from a structured assessment. When present, prefer them over generic inferences from age and personality_tags alone. wizard_eyesight (sharp/corrected/limited) is relevant for precision sports and activities requiring strong visual tracking. wizard_agility (high/moderate/low) is relevant for sports demanding quick footwork and flexibility like gymnastics, badminton, or kabaddi.
GIVE EACH FIELD ONE JOB, NEVER REPEAT CONTENT ACROSS FIELDS: "profileAnalysis" ONLY covers the child's personality/fitness/age and never discusses whether their goal is realistic. "goalAssessment.rationale" ONLY covers the realism reasoning (timeframe, level, hours) and must NOT re-describe the child's personality — assume the reader already read profileAnalysis. "recommendedPlatformActions" ONLY lists actions the parent takes on the PowerMySport platform itself (e.g. book a trial with a coach, message a coach, browse a nearby academy listing) and must NEVER list training drills or practice milestones — those belong only in journeyPhases milestones.
${
  hasSport
    ? 'The profile includes a specific "sport". Focus your analysis on how to progress in that sport. Do NOT include "recommendedSports" in your response.'
    : 'The profile has NO specific sport. Recommend the top 3 sports that best fit the child based on personality, goals, age, and fitness. Include these in the "recommendedSports" array.'
}
Always include a "journeyPhases" plan: a sequential, time-bound roadmap of 4-6 phases that moves the child from their current level toward their goal. If the parent's question names a specific target (e.g. a ranking, a tournament level, or a timeframe like "6 months"), the phases MUST be tailored to reach that exact target and the timeframes MUST add up to it. Each phase builds on the previous one and reads like a clear, motivating roadmap a parent can follow.
Always include "goalAssessment": directly and HONESTLY answer the parent's specific question (parent_specific_question) and judge how realistic their goal is for THIS child in the stated timeframe — never blindly optimistic. Ground it with a concrete benchmark (what players/children at the target level typically do).
Always include "costBreakdown" and an "estimatedCost" on every phase: all money MUST be in Indian Rupees (₹), scaled to the child's "budget_tier" and "location" (an Indian state). Give realistic ranges and make clear these are indicative figures that vary by city and academy — do NOT invent precise prices.
For each phase include "pathwayLevel": a number 1–5 indicating which sports pathway tier this phase targets, ascending from 1 (entry tier) to 5 (elite/global tier) — the exact tier names are sport-specific and defined elsewhere, so only the number matters here. "current_pathway_level", when present, means the child is ALREADY actively playing at that exact tier right now — Phase 1 must start from "how do we progress/improve from here", NOT "should we start" or "is this the right time to begin". When current_pathway_level is absent, assume the child has not yet reached the level under discussion and Phase 1 should assess readiness to begin.
Use "years_playing" (how long the child has already been playing this sport, in years — 0 means brand new) as real experience context, separate from current_pathway_level: a child can have played casually for years without ever reaching a formal tier, or reach a tier quickly with very little total time in the sport. Let it inform how much foundational technique/habit-correction work is realistic to assume, how cautious to be about injury risk from accumulated load, and how aggressive a timeline is credible in "goalAssessment" — do not treat it as identical to current_pathway_level.
Return ONLY a valid JSON object — no markdown, no preamble — matching this schema exactly:
{
  "profileAnalysis": "2-3 sentences: ONLY the child's personality, fitness, and age, and how these traits suit sport in general. Do NOT say whether their specific goal is realistic — that belongs in goalAssessment",
  "idealCoachingStyle": "Specific description of the coaching style and communication approach that fits this child's personality and age — what to look for when hiring",
  "weeklyBlueprint": {
    "trainingHours": "Specific hours per week for structured training",
    "freePlayHours": "Hours per week for unstructured free play",
    "restDays": "How many rest days and why"
  },
  "recommendedPlatformActions": "Single string (not array) containing 3-4 specific actions the parent takes ON THE POWERMYSPORT PLATFORM ITSELF to get started (e.g. book a trial with a coach, message a coach, browse a nearby academy listing) — NOT training drills or practice milestones, those belong only in journeyPhases milestones",${
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
    "rationale": "1-2 sentences directly answering the parent's question and justifying the verdict using THIS child's age, level and time commitment. Do NOT repeat the personality/fitness read from profileAnalysis",
    "benchmark": "A concrete reference point — what children/players at the target level typically do (e.g. training hours, tournaments per season, realistic timeline) so the parent has an honest yardstick"
  },
  "costBreakdown": {
    "monthlyCoaching": "Indicative monthly coaching cost range in INR for this budget_tier and location (e.g. '₹6,000–10,000/month')",
    "equipment": "Indicative equipment & gear cost range in INR (one-time/seasonal)",
    "tournaments": "Indicative cost range in INR for tournament entries + travel across the plan period"
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
const guidanceModelCandidates = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
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

  let groundingContext = "";
  if (payload.sport && payload.location) {
    const slug = payload.sport.trim().toLowerCase().replace(/\s+/g, "-");
    const stateSlug = payload.location
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const levelIndex =
      Math.max(1, Math.min(5, payload.current_pathway_level || 1)) - 1;

    try {
      // Prefer the new split models (SportBasePath + SportStatePath) — they give
      // richer, more accurate grounding and avoid redundant per-state regeneration.
      const [basePath, statePath] = await Promise.all([
        SportBasePath.findOne({ sportSlug: slug }).lean(),
        SportStatePath.findOne({ sportSlug: slug, stateSlug }).lean(),
      ]);

      if (basePath && (basePath as any).levels?.length > 0) {
        const levelObj = (basePath as any).levels[levelIndex];
        if (levelObj) {
          const groundingObj: Record<string, unknown> = {
            level: levelObj.level,
            title: levelObj.title,
            benchmarks: levelObj.benchmarks,
            trialInfo: levelObj.trialInfo,
            talentSignals: levelObj.talentSignals,
            mentalSkillsFocus: levelObj.mentalSkillsFocus,
            coachSelectionGuide: levelObj.coachSelectionGuide,
          };
          if (statePath) {
            groundingObj.stateContext = {
              stateAssociation: (statePath as any).stateAssociation,
              topAcademies: (statePath as any).topAcademies,
              feeRange: (statePath as any).feeRange,
              governmentSchemes: (statePath as any).governmentSchemes,
              regionalCalendar: (statePath as any).regionalCalendar,
            };
          }
          groundingContext = JSON.stringify(groundingObj, null, 2);
        }
      } else {
        // Fall back to the monolithic SportPathway for sports/states not yet
        // migrated to the new split model.
        const cacheKey = `${slug}_${stateSlug}`;
        const pathway = await SportPathway.findOne({ cacheKey }).lean();
        if (
          pathway &&
          (pathway as any).levels &&
          (pathway as any).levels.length > 0
        ) {
          const levelObj = (pathway as any).levels[levelIndex];
          if (levelObj) {
            groundingContext = JSON.stringify(
              {
                level: levelObj.level,
                title: levelObj.title,
                benchmarks: levelObj.benchmarks,
                trialInfo: levelObj.trialInfo,
                talentSignals: levelObj.talentSignals,
              },
              null,
              2,
            );
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch grounding context for guidance AI", e);
    }
  }

  for (const modelName of guidanceModelCandidates) {
    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: JSON.stringify(payload),
        config: {
          systemInstruction: getYouthSportsGuidanceSystemPrompt(
            !!payload.sport,
            payload.child_age,
            groundingContext,
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

export const sportMatchRequestSchema = z.object({
  personality_tags: z.array(z.string()),
  primary_objective: z.string(),
  budget_tier: z.string(),
  child_age: z.number(),
  location: z.string(),
  gender: z.string().optional(),
  height_cm: z.number().optional(),
  weight_kg: z.number().optional(),
  medical_conditions: z.array(z.string()).optional(),
  team_preference: z.string().optional(),
  indoor_outdoor_preference: z.string().optional(),
  intensity_preference: z.string().optional(),
  weekly_time_commitment: z.number().optional(),
  school_sport_involvement: z.boolean().optional(),
});

export const sportMatchRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      sportSlug: z.string(),
      sportName: z.string(),
      matchScore: z.number(),
      reasons: z.array(z.string()).length(3),
      monthlyCostRange: z.string().nullable(),
      keyTalentSignal: z.string().nullable(),
    }),
  ),
});

export type SportMatchRequest = z.infer<typeof sportMatchRequestSchema>;
export type SportMatchResponse = z.infer<typeof sportMatchRecommendationSchema>;

export const generateSportMatchRecommendation = async (
  request: SportMatchRequest,
  topSports: Array<{
    sportSlug: string;
    sportName: string;
    matchScore: number;
    category: string;
    talentSignals: string;
    equipmentCost: string;
    overview: string;
    hasGeneratedPathway: boolean;
  }>,
): Promise<SportMatchResponse> => {
  const genAI = getGuidanceClient();
  let lastError: unknown = null;
  let sawQuotaIssue = false;

  const groundingData = JSON.stringify(topSports, null, 2);

  const physicalProfile = [
    request.height_cm ? `Height: ${request.height_cm} cm` : null,
    request.weight_kg ? `Weight: ${request.weight_kg} kg` : null,
    request.medical_conditions?.length
      ? `Medical conditions: ${request.medical_conditions.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  const preferences = [
    request.team_preference ? `Team/individual preference: ${request.team_preference}` : null,
    request.indoor_outdoor_preference ? `Indoor/outdoor: ${request.indoor_outdoor_preference}` : null,
    request.intensity_preference ? `Intensity: ${request.intensity_preference}` : null,
    request.weekly_time_commitment ? `Weekly time: ${request.weekly_time_commitment} hrs` : null,
    request.school_sport_involvement !== undefined
      ? `School sport involvement: ${request.school_sport_involvement ? "Yes" : "No"}`
      : null,
  ]
    .filter(Boolean)
    .join("; ");

  const systemPrompt = `You are an expert Indian sports development consultant advising a parent who is unsure what sport their child should play.
You will receive context about 3 recommended sports and the child's profile.

CHILD PROFILE:
Age: ${request.child_age}${request.gender ? `\nGender: ${request.gender}` : ""}
Personality: ${request.personality_tags.join(", ")}
Objective: ${request.primary_objective}${physicalProfile ? `\nPhysical profile: ${physicalProfile}` : ""}${preferences ? `\nPreferences: ${preferences}` : ""}

GROUNDING CONTEXT (3 SPORTS):
${groundingData}

INSTRUCTIONS:
For each of these 3 sports, write 3 short bullets explaining why THIS sport fits THIS child's personality_tags, primary_objective, physical profile, and stated preferences — name the child's actual traits (e.g. 'Your child's Focused and Patient traits suit archery's precision demands') and physical attributes where relevant (e.g. height advantage for basketball, low-impact option given medical condition). Never invent facts. If a medical condition rules out or strongly cautions against a sport, mention it clearly.

WRITE IN THE SIMPLEST POSSIBLE ENGLISH — short sentences, common everyday words only. Each bullet max 12-15 words. If a reason needs a caveat to make sense, cut it.

For any sport where hasGeneratedPathway is false, ground each reason in that sport's sportDescription and attributes fields only. Do not use the word 'individual', 'team', or the raw category name as the reason itself; name the concrete motion/demand instead. Set monthlyCostRange and keyTalentSignal to null.
For sports where hasGeneratedPathway is true, return the monthlyCostRange and one keyTalentSignal taken directly from the pathway data.

Before finalizing, check each reason: if it could be copy-pasted onto a different sport in the same category by only swapping the sport name, rewrite it using a fact from sportDescription, keyFocus, or mentalSkillsFocus that is unique to this sport.

MATCH SCORE: Compute a unique matchScore (0–100) for each sport that honestly reflects how well it fits THIS child's complete profile — personality, physical build, medical conditions, team/intensity preferences, age, objective, and budget. Scores MUST differ meaningfully between the 3 sports so the parent can distinguish between them. The top sport should score highest, but no sport should reach 100 unless it is a near-perfect fit on every dimension. A sport that matches on personality but conflicts on intensity preference or has a medical risk should score noticeably lower. Do NOT copy the matchScore from the grounding context — compute it fresh.

Return ONLY a valid JSON object matching this schema exactly:
{
  "recommendations": [
    {
      "sportSlug": "string",
      "sportName": "string",
      "matchScore": <your computed 0-100 score — must differ between sports>,
      "reasons": ["string", "string", "string"],
      "monthlyCostRange": "string or null",
      "keyTalentSignal": "string or null"
    }
  ]
}`;

  for (const modelName of guidanceModelCandidates) {
    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: "Generate the sport match recommendations.",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) throw new Error("Empty response from model");

      const parsed = JSON.parse(rawText);
      return sportMatchRecommendationSchema.parse(parsed);
    } catch (error) {
      lastError = error;
      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (isQuotaOrRateLimitError(errorMessage)) {
        sawQuotaIssue = true;
        continue;
      }
      if (!isModelUnavailableError(errorMessage)) throw error;
    }
  }

  if (sawQuotaIssue) {
    throw new Error(
      "Guidance generation temporarily unavailable due to quota limits.",
    );
  }
  throw new Error(
    `No supported Gemini model found for sport match. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
};
