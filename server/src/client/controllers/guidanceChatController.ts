import { Request, Response } from "express";
import mongoose from "mongoose";
import { GuidanceSubmission } from "../models/GuidanceSubmission";
import { GuidanceChatSession } from "../models/GuidanceChatSession";
import { buildChatSystemPrompt } from "../../shared/services/guidanceChatService";
import { streamChatAndPersist } from "../../shared/services/chatStreamService";
import {
  DAILY_MESSAGE_CAP,
  LIFETIME_MESSAGE_CAP,
  getDailyMessageCount,
  checkChatRateLimit,
} from "../../shared/services/chatRateLimitService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// ─── Opening assistant message ────────────────────────────────────────────────

function buildOpeningMessage(
  sport: string | undefined,
  childAge: number,
  parentQuestion: string | undefined
): string {
  const sportLabel = sport || "sport";
  const opener = parentQuestion
    ? `I've reviewed your question about ${parentQuestion.slice(0, 80)}${parentQuestion.length > 80 ? "…" : ""}.`
    : `I've reviewed your ${sportLabel} roadmap for your ${childAge}-year-old.`;

  return `Hi! 👋 ${opener} I'm your sports development coach and I'm here to help you go deeper on any part of the guidance.

Feel free to ask me about specific drills, how to adjust the weekly schedule, what the journey phases mean day-to-day, equipment, mental skills, or anything else about the plan. What would you like to explore first?`;
}

// ─── GET /api/guidance/:submissionId/chat ────────────────────────────────────

export const getGuidanceChat = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const { submissionId } = req.params;
  if (!submissionId || !mongoose.isValidObjectId(submissionId)) {
    throw new AppError("Invalid submission ID", 400);
  }

  // Load submission to verify existence & ownership
  const submission = await GuidanceSubmission.findById(submissionId).lean();
  if (!submission) {
    throw new AppError("Guidance submission not found", 404);
  }

  // Ownership: if the submission has a userId, it must match the requester
  if (submission.userId && submission.userId.toString() !== req.user.id) {
    throw new AppError("Access denied", 403);
  }

  // Lazily claim ownership if submission was created as guest
  if (!submission.userId) {
    await GuidanceSubmission.updateOne({ _id: submissionId }, { $set: { userId: req.user.id } });
  }

  // Find or create the session
  let session = await GuidanceChatSession.findOne({
    submissionId,
    userId: req.user.id,
  }).lean();

  if (!session) {
    // Seed with the opening assistant message
    const openingContent = buildOpeningMessage(
      submission.request.sport,
      submission.request.child_age,
      submission.request.parent_specific_question
    );
    const newSession = await GuidanceChatSession.create({
      submissionId,
      userId: req.user.id,
      messages: [
        {
          role: "assistant",
          content: openingContent,
          createdAt: new Date(),
        },
      ],
    });
    session = newSession.toObject();
  }

  const dailyMessageCount = await getDailyMessageCount(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      messages: session.messages,
      dailyMessageCount,
      totalMessageCount: session.totalMessageCount,
      dailyRemaining: Math.max(0, DAILY_MESSAGE_CAP - dailyMessageCount),
      lifetimeRemaining: Math.max(0, LIFETIME_MESSAGE_CAP - (session.totalMessageCount || 0)),
    },
  });
});

// ─── POST /api/guidance/:submissionId/chat ───────────────────────────────────

export const sendGuidanceChatMessage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401);
      }

      const { submissionId } = req.params;
      if (!submissionId || !mongoose.isValidObjectId(submissionId)) {
        throw new AppError("Invalid submission ID", 400);
      }

      const userMessage: string = (req.body?.message ?? "").trim();
      if (!userMessage) {
        throw new AppError("Message is required", 400);
      }
      if (userMessage.length > 2000) {
        throw new AppError("Message too long (max 2000 characters)", 400);
      }

      // Load submission
      const submission = await GuidanceSubmission.findById(submissionId).lean();
      if (!submission) {
        throw new AppError("Guidance submission not found", 404);
      }

      // Ownership check
      if (submission.userId && submission.userId.toString() !== req.user.id) {
        throw new AppError("Access denied", 403);
      }

      // Claim guest submission
      if (!submission.userId) {
        await GuidanceSubmission.updateOne(
          { _id: submissionId },
          { $set: { userId: req.user.id } }
        );
      }

      // Load or create session
      let session = await GuidanceChatSession.findOne({
        submissionId,
        userId: req.user.id,
      });

      if (!session) {
        const openingContent = buildOpeningMessage(
          submission.request.sport,
          submission.request.child_age,
          submission.request.parent_specific_question
        );
        session = await GuidanceChatSession.create({
          submissionId,
          userId: req.user.id,
          messages: [{ role: "assistant", content: openingContent, createdAt: new Date() }],
        });
      }

      // ── Rate limit checks (§10) ──────────────────────────────────────────────
      // Daily cap is global per user (across all their guidance submissions), not
      // per session — reserved atomically via Redis so concurrent requests can't
      // both slip past the cap.
      const rateLimit = await checkChatRateLimit(req.user.id, session.totalMessageCount, {
        dailyReached: `You've reached today's limit of ${DAILY_MESSAGE_CAP} messages. Come back tomorrow to continue the conversation!`,
        lifetimeReached: `You've had an in-depth coaching conversation for this guidance plan! Consider generating a fresh roadmap to continue your journey.`,
      });
      if (!rateLimit.ok) {
        res.status(rateLimit.status).json({
          success: false,
          message: rateLimit.message,
          code: rateLimit.code,
        });
        return;
      }

      // ── Build system prompt ──────────────────────────────────────────────────
      const systemPrompt = buildChatSystemPrompt(
        submission.request as any,
        submission.response as any
      );

      // ── Stream response and persist both turns ───────────────────────────────
      await streamChatAndPersist(res, req.user.id, session, systemPrompt, userMessage);
    } catch (error) {
      // If headers not sent yet, return JSON error; otherwise end the stream
      if (!res.headersSent) {
        const statusCode = error instanceof AppError ? error.statusCode : 500;
        res.status(statusCode).json({
          success: false,
          message: error instanceof Error ? error.message : "Chat request failed",
        });
      } else {
        res.write(
          `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Server error" })}\n\n`
        );
        res.end();
      }
    }
  }
);
