import { Request, Response } from "express";
import mongoose from "mongoose";
import { AssistantChatSession } from "../models/AssistantChatSession";
import { buildAssistantChatSystemPrompt } from "../../shared/services/assistantChatService";
import { streamChatAndPersist } from "../../shared/services/chatStreamService";
import { retrieveRelevantChunks } from "../../shared/services/knowledgeRetrievalService";
import { ASSISTANT_CHAT_TOOLS } from "../../shared/services/chatToolsService";
import {
  DAILY_MESSAGE_CAP,
  LIFETIME_MESSAGE_CAP,
  getDailyMessageCount,
  checkChatRateLimit,
} from "../../shared/services/chatRateLimitService";

const OPENING_MESSAGE = `Hi! 👋 I'm the PowerMySport Assistant. Ask me anything about youth sports, how the platform works, or where to find something — whether that's finding the right sport for your child, or building a personalized plan once you've picked one. What's on your mind?`;

function deriveTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().slice(0, 60);
  const lastSpace = trimmed.lastIndexOf(" ");
  const cut = lastSpace > 30 ? trimmed.slice(0, lastSpace) : trimmed;
  return cut + (firstUserMessage.trim().length > 60 ? "…" : "");
}

// ─── GET /api/assistant-chat/sessions ────────────────────────────────────────
// List all assistant chat sessions for the authenticated user, newest first.

export const listAssistantChatSessions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const sessions = await AssistantChatSession.find({ userId: req.user.id })
      .select("_id title totalMessageCount createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to list sessions",
    });
  }
};

// ─── POST /api/assistant-chat/sessions ───────────────────────────────────────
// Create a brand-new session — called every time the assistant is opened, so
// it always starts fresh (history is reachable separately, not auto-resumed).

export const createAssistantChatSession = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const session = await AssistantChatSession.create({
      userId: req.user.id,
      title: null,
      messages: [{ role: "assistant", content: OPENING_MESSAGE, createdAt: new Date() }],
    });

    const dailyMessageCount = await getDailyMessageCount(req.user.id);

    res.status(201).json({
      success: true,
      data: {
        sessionId: session._id,
        messages: session.messages,
        dailyMessageCount,
        totalMessageCount: session.totalMessageCount,
        dailyRemaining: Math.max(0, DAILY_MESSAGE_CAP - dailyMessageCount),
        lifetimeRemaining: Math.max(0, LIFETIME_MESSAGE_CAP - session.totalMessageCount),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create session",
    });
  }
};

// ─── GET /api/assistant-chat/sessions/:sessionId ─────────────────────────────

export const getAssistantChatSession = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { sessionId } = req.params;
    if (!mongoose.isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: "Invalid session ID" });
      return;
    }

    const session = await AssistantChatSession.findOne({
      _id: sessionId as string,
      userId: req.user.id,
    }).lean();

    if (!session) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    const dailyMessageCount = await getDailyMessageCount(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session._id,
        title: session.title,
        messages: session.messages,
        dailyMessageCount,
        totalMessageCount: session.totalMessageCount,
        dailyRemaining: Math.max(0, DAILY_MESSAGE_CAP - dailyMessageCount),
        lifetimeRemaining: Math.max(0, LIFETIME_MESSAGE_CAP - session.totalMessageCount),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch session",
    });
  }
};

// ─── POST /api/assistant-chat/sessions/:sessionId ────────────────────────────

export const sendAssistantChatSessionMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { sessionId } = req.params;
    if (!mongoose.isValidObjectId(sessionId)) {
      res.status(400).json({ success: false, message: "Invalid session ID" });
      return;
    }

    const userMessage: string = (req.body?.message ?? "").trim();
    if (!userMessage) {
      res.status(400).json({ success: false, message: "Message is required" });
      return;
    }
    if (userMessage.length > 2000) {
      res.status(400).json({
        success: false,
        message: "Message too long (max 2000 characters)",
      });
      return;
    }

    const session = await AssistantChatSession.findOne({
      _id: sessionId as string,
      userId: req.user.id,
    });

    if (!session) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    const rateLimit = await checkChatRateLimit(req.user.id, session.totalMessageCount, {
      dailyReached: `You've reached today's limit of ${DAILY_MESSAGE_CAP} messages. Come back tomorrow to continue the conversation!`,
      lifetimeReached: `You've had a long conversation in this chat! Start a new chat to keep going.`,
    });
    if (!rateLimit.ok) {
      res.status(rateLimit.status).json({
        success: false,
        message: rateLimit.message,
        code: rateLimit.code,
      });
      return;
    }

    // Auto-title on first user message, same as roadmap chat's history list.
    const isFirstUserMessage = !session.messages.some((m) => m.role === "user");
    if (isFirstUserMessage && !session.title) {
      session.title = deriveTitle(userMessage);
    }

    const retrievedChunks = await retrieveRelevantChunks(userMessage);
    const systemPrompt = buildAssistantChatSystemPrompt(retrievedChunks);

    await streamChatAndPersist(
      res,
      req.user.id,
      session,
      systemPrompt,
      userMessage,
      ASSISTANT_CHAT_TOOLS,
    );
  } catch (error) {
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
