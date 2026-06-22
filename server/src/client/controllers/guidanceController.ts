import { Request, Response } from "express";
import {
  generateYouthSportsGuidance,
  guidanceRequestSchema,
} from "../../shared/services/guidanceAiService";
import { GuidanceSubmission } from "../models/GuidanceSubmission";

// ─── Rule-based burnout risk — zero AI cost ───────────────────────────────────

const BURNOUT_THRESHOLDS: Array<{ maxAge: number; medium: number; high: number }> = [
  { maxAge: 7,  medium: 5,  high: 8  },
  { maxAge: 9,  medium: 8,  high: 12 },
  { maxAge: 11, medium: 10, high: 15 },
  { maxAge: 13, medium: 14, high: 20 },
  { maxAge: 15, medium: 18, high: 25 },
  { maxAge: 21, medium: 22, high: 30 },
];

function calculateBurnoutRisk(age: number, weeklyHours: number) {
  const bracket = BURNOUT_THRESHOLDS.find((t) => age <= t.maxAge) ?? BURNOUT_THRESHOLDS[BURNOUT_THRESHOLDS.length - 1]!;

  if (weeklyHours >= bracket.high) {
    return {
      level: "high" as const,
      message: `${weeklyHours} hours/week is very high for a ${age}-year-old. Research shows this significantly raises the risk of burnout, overuse injuries, and early sport dropout.`,
      recommendations: [
        "Cap structured sport at 3–4 days/week with a certified coach",
        "Ensure at least 2 full rest days with zero sport activity",
        "Replace 20–30% of training with unstructured free play the child controls",
        "Watch for: loss of enthusiasm, persistent fatigue, unexplained pain, sleep problems",
        "Consult a sports physiotherapist to review the current training load",
      ],
    };
  }

  if (weeklyHours >= bracket.medium) {
    return {
      level: "medium" as const,
      message: `${weeklyHours} hours/week is on the higher end for a ${age}-year-old. Monitor closely for fatigue and enjoyment levels.`,
      recommendations: [
        "Ensure at least 1–2 complete rest days per week",
        "Balance structured training with free, child-directed play",
        "Do a weekly check-in: ask your child if they're enjoying training, not just performing",
      ],
    };
  }

  return {
    level: "low" as const,
    message: `${weeklyHours} hours/week is age-appropriate for a ${age}-year-old — a healthy foundation.`,
    recommendations: [],
  };
}

export const submitGuidance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const parsed = guidanceRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid guidance payload",
        issues: parsed.error.flatten(),
      });
      return;
    }

    const guidance = await generateYouthSportsGuidance(parsed.data);

    // Enrich with server-computed fields (zero AI cost)
    const burnoutRisk = calculateBurnoutRisk(
      parsed.data.child_age,
      parsed.data.weekly_time_commitment,
    );
    const enrichedGuidance = { ...guidance, burnoutRisk };

    const createPayload: any = {
      request: parsed.data,
      response: enrichedGuidance,
    };
    if (req.user?.id) {
      createPayload.userId = req.user.id;
    }
    const guidanceSubmission = await GuidanceSubmission.create(createPayload);

    res.status(201).json({
      success: true,
      message: "Guidance generated and saved",
      data: {
        id: guidanceSubmission._id.toString(),
        query: guidanceSubmission.request,
        response: enrichedGuidance,
        createdAt: guidanceSubmission.createdAt,
        updatedAt: guidanceSubmission.updatedAt,
      },
    });
  } catch (error) {
    let errorMessage =
      error instanceof Error ? error.message : "Failed to generate guidance";

    // Attempt to parse Gemini's raw JSON error array
    try {
      const parsedError = JSON.parse(errorMessage);
      if (Array.isArray(parsedError) && parsedError[0]?.error?.message) {
        errorMessage = parsedError[0].error.message;
      } else if (parsedError?.error?.message) {
        errorMessage = parsedError.error.message;
      }
    } catch {
      // Not a JSON string, ignore and use as is
    }

    const normalizedMessage = errorMessage.toLowerCase();
    const isTemporarilyUnavailable =
      normalizedMessage.includes("quota") ||
      normalizedMessage.includes("rate limit") ||
      normalizedMessage.includes("too many requests") ||
      normalizedMessage.includes("temporarily unavailable");

    res.status(isTemporarilyUnavailable ? 503 : 500).json({
      success: false,
      message: errorMessage,
    });
  }
};

export const getGuidanceHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const history = await GuidanceSubmission.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: history.map((doc) => ({
        id: doc._id.toString(),
        query: doc.request,
        response: doc.response,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch guidance history",
    });
  }
};
