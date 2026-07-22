// ─── Find-Sport Scoring — Testing Only ─────────────────────────────────────
// Controller for the testing-only sport-scoring endpoint. See
// server/src/shared/utils/findSportTestScorer.ts for context — this is NOT
// used by the live wizard.

import { Request, Response } from "express";
import { z } from "zod";
import { scoreSports } from "../utils/findSportTestScorer";

const wizardAnswersSchema = z.object({
  childName: z.string().default(""),
  age: z.number().nullable().default(null),
  gender: z.enum(["boy", "girl", "prefer-not"]).nullable().default(null),
  state: z.string().nullable().default(null),
  priorSports: z.array(z.string()).default([]),
  sportsInFamily: z.array(z.string()).default([]),
  peerSports: z.array(z.string()).default([]),
  informalSports: z.array(z.string()).default([]),
  informalReaction: z.enum(["kept-asking", "lost-interest"]).nullable().default(null),
  height: z.number().nullable().default(null),
  weight: z.number().nullable().default(null),
  energyType: z.enum(["explosive", "endurance"]).nullable().default(null),
  motorType: z.enum(["gross", "fine"]).nullable().default(null),
  visualTracking: z.enum(["strong", "moderate", "weak"]).nullable().default(null),
  eyesight: z.enum(["sharp", "corrected", "limited"]).nullable().default(null),
  agility: z.enum(["high", "moderate", "low"]).nullable().default(null),
  teamIndividual: z.number().nullable().default(null),
  competitiveResponse: z.enum(["fired-up", "calm", "discouraged"]).nullable().default(null),
  focusStyle: z.enum(["bursts", "sustained"]).nullable().default(null),
  decisionStyle: z.enum(["react", "strategic"]).nullable().default(null),
  pressureResponse: z.enum(["thrives", "manages", "avoids"]).nullable().default(null),
  repetitionTolerance: z.enum(["high", "low"]).nullable().default(null),
  contactComfort: z.enum(["loves", "neutral", "avoids"]).nullable().default(null),
  environment: z.enum(["outdoor", "indoor", "no-preference"]).nullable().default(null),
  waterComfort: z.enum(["comfortable", "neutral", "uncomfortable"]).nullable().default(null),
  budget: z.enum(["under-3k", "3k-7k", "7k-15k", "15k-plus"]).nullable().default(null),
  ambition: z.enum(["fun", "competitive", "national", "professional"]).nullable().default(null),
  futureFlexibility: z.enum(["all-in", "maybe", "stay-local"]).nullable().default(null),
  weeklyHours: z.enum(["1-3", "4-7", "8-12", "13-plus"]).nullable().default(null),
});

/**
 * POST /api/find-sport-test/score
 * Testing-only mirror of the client's scoreSports() — see findSportTestScorer.ts.
 * Every field is optional; omitted fields default to null/empty so a caller can
 * send a minimal payload focused on just the fields they're exercising.
 */
export const scoreSport = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = wizardAnswersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid payload",
        issues: parsed.error.flatten(),
      });
      return;
    }

    const results = scoreSports(parsed.data);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error scoring sport (test endpoint):", error);
    res.status(500).json({
      success: false,
      message: "Failed to score sport",
    });
  }
};
