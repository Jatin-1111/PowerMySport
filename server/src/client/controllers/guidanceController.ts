import { Request, Response } from "express";
import {
  generateYouthSportsGuidance,
  guidanceRequestSchema,
} from "../../shared/services/guidanceAiService";
import { GuidanceSubmission } from "../models/GuidanceSubmission";

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
    const guidanceSubmission = await GuidanceSubmission.create({
      request: parsed.data,
      response: guidance,
    });

    res.status(201).json({
      success: true,
      message: "Guidance generated and saved",
      data: {
        id: guidanceSubmission._id.toString(),
        query: guidanceSubmission.request,
        response: guidanceSubmission.response,
        createdAt: guidanceSubmission.createdAt,
        updatedAt: guidanceSubmission.updatedAt,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate guidance";
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
