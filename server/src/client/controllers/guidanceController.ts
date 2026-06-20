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
    const createPayload: any = {
      request: parsed.data,
      response: guidance,
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
        response: guidanceSubmission.response,
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
