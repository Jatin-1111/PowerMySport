import { Request, Response } from "express";
import mongoose from "mongoose";
import { GuidanceSubmission } from "../models/GuidanceSubmission";
import { GuidanceChatSession } from "../models/GuidanceChatSession";
import {
  buildChatSystemPrompt,
  streamGuidanceChatResponse,
} from "../../shared/services/guidanceChatService";
import {
  DAILY_MESSAGE_CAP,
  getDailyMessageCount,
  incrementDailyMessageCount,
  decrementDailyMessageCount,
} from "../../shared/services/chatRateLimitService";

// ─── Rate-limit constants (§10) ───────────────────────────────────────────────

const LIFETIME_MESSAGE_CAP = 150;

// ─── Opening assistant message ────────────────────────────────────────────────

function buildOpeningMessage(
  sport: string | undefined,
  childAge: number,
  parentQuestion: string | undefined,
): string {
  const sportLabel = sport || "sport";
  const opener = parentQuestion
    ? `I've reviewed your question about ${parentQuestion.slice(0, 80)}${parentQuestion.length > 80 ? "…" : ""}.`
    : `I've reviewed your ${sportLabel} roadmap for your ${childAge}-year-old.`;

  return `Hi! 👋 ${opener} I'm your sports development coach and I'm here to help you go deeper on any part of the guidance.

Feel free to ask me about specific drills, how to adjust the weekly schedule, what the journey phases mean day-to-day, equipment, mental skills, or anything else about the plan. What would you like to explore first?`;
}

// ─── GET /api/guidance/:submissionId/chat ────────────────────────────────────

export const getGuidanceChat = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const { submissionId } = req.params;
    if (!submissionId || !mongoose.isValidObjectId(submissionId)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid submission ID" });
      return;
    }

    // Load submission to verify existence & ownership
    const submission = await GuidanceSubmission.findById(submissionId).lean();
    if (!submission) {
      res
        .status(404)
        .json({ success: false, message: "Guidance submission not found" });
      return;
    }

    // Ownership: if the submission has a userId, it must match the requester
    if (submission.userId && submission.userId.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    // Lazily claim ownership if submission was created as guest
    if (!submission.userId) {
      await GuidanceSubmission.updateOne(
        { _id: submissionId },
        { $set: { userId: req.user.id } },
      );
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
        submission.request.parent_specific_question,
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
        lifetimeRemaining: Math.max(
          0,
          LIFETIME_MESSAGE_CAP - (session.totalMessageCount || 0),
        ),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch chat session",
    });
  }
};

// ─── POST /api/guidance/:submissionId/chat ───────────────────────────────────

export const sendGuidanceChatMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const { submissionId } = req.params;
    if (!submissionId || !mongoose.isValidObjectId(submissionId)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid submission ID" });
      return;
    }

    const userMessage: string = (req.body?.message ?? "").trim();
    if (!userMessage) {
      res.status(400).json({ success: false, message: "Message is required" });
      return;
    }
    if (userMessage.length > 2000) {
      res
        .status(400)
        .json({
          success: false,
          message: "Message too long (max 2000 characters)",
        });
      return;
    }

    // Load submission
    const submission = await GuidanceSubmission.findById(submissionId).lean();
    if (!submission) {
      res
        .status(404)
        .json({ success: false, message: "Guidance submission not found" });
      return;
    }

    // Ownership check
    if (submission.userId && submission.userId.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    // Claim guest submission
    if (!submission.userId) {
      await GuidanceSubmission.updateOne(
        { _id: submissionId },
        { $set: { userId: req.user.id } },
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
        submission.request.parent_specific_question,
      );
      session = await GuidanceChatSession.create({
        submissionId,
        userId: req.user.id,
        messages: [
          { role: "assistant", content: openingContent, createdAt: new Date() },
        ],
      });
    }

    // ── Rate limit checks (§10) ──────────────────────────────────────────────
    // Daily cap is global per user (across all their guidance submissions), not
    // per session — reserved atomically via Redis so concurrent requests can't
    // both slip past the cap.
    const dailyCount = await incrementDailyMessageCount(req.user.id);
    if (dailyCount > DAILY_MESSAGE_CAP) {
      await decrementDailyMessageCount(req.user.id);
      res.status(429).json({
        success: false,
        message: `You've reached today's limit of ${DAILY_MESSAGE_CAP} messages. Come back tomorrow to continue the conversation!`,
        code: "DAILY_LIMIT_REACHED",
      });
      return;
    }

    if (session.totalMessageCount >= LIFETIME_MESSAGE_CAP) {
      await decrementDailyMessageCount(req.user.id); // this message never went through
      res.status(429).json({
        success: false,
        message: `You've had an in-depth coaching conversation for this guidance plan! Consider generating a fresh roadmap to continue your journey.`,
        code: "LIFETIME_LIMIT_REACHED",
      });
      return;
    }

    // ── Build system prompt ──────────────────────────────────────────────────
    const systemPrompt = buildChatSystemPrompt(
      submission.request as any,
      submission.response as any,
    );

    // ── Prepare history for Gemini (exclude opening if it's the only message) ─
    const historyForAI = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // ── Stream response ──────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let fullAssistantResponse = "";

    try {
      for await (const chunk of streamGuidanceChatResponse(
        systemPrompt,
        historyForAI,
        userMessage,
      )) {
        fullAssistantResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    } catch (aiError) {
      await decrementDailyMessageCount(req.user.id); // the message never actually went through
      res.write(
        `data: ${JSON.stringify({ error: aiError instanceof Error ? aiError.message : "AI error" })}\n\n`,
      );
      res.end();
      return;
    }

    // Signal stream completion
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    // ── Persist both turns to the session ────────────────────────────────────
    const userTurn = {
      role: "user" as const,
      content: userMessage,
      createdAt: new Date(),
    };
    const assistantTurn = {
      role: "assistant" as const,
      content: fullAssistantResponse,
      createdAt: new Date(),
    };

    session.messages.push(userTurn, assistantTurn);
    session.totalMessageCount += 1;
    await session.save();
  } catch (error) {
    // If headers not sent yet, return JSON error; otherwise end the stream
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Chat request failed",
      });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Server error" })}\n\n`,
      );
      res.end();
    }
  }
};
