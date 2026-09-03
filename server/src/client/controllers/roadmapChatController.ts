import { Request, Response } from "express";
import mongoose from "mongoose";
import { PathwayGuide } from "../../shared/models/PathwayGuide";
import { RoadmapChatSession } from "../models/RoadmapChatSession";
import { buildRoadmapChatSystemPrompt } from "../../shared/services/roadmapChatService";
import { streamChatAndPersist } from "../../shared/services/chatStreamService";
import { getUpcomingEditions } from "../../shared/services/tournamentEditionQueries";
import {
  DAILY_MESSAGE_CAP,
  LIFETIME_MESSAGE_CAP,
  getDailyMessageCount,
  checkChatRateLimit,
} from "../../shared/services/chatRateLimitService";

function buildOpeningMessage(sportName: string): string {
  return `Hi! 👋 I can see you're exploring the ${sportName} pathway. I'm your sports coach — ask me anything about this stage: what to do next, what it costs, how to find a coach, or what a term on this page means. What would you like to know?`;
}

function deriveTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().slice(0, 60);
  const lastSpace = trimmed.lastIndexOf(" ");
  const cut = lastSpace > 30 ? trimmed.slice(0, lastSpace) : trimmed;
  return cut + (firstUserMessage.trim().length > 60 ? "…" : "");
}

// Only a PUBLISHED guide grounds the chat. A draft is an author's working copy,
// and answering a parent out of one would quote them content the site itself is
// not yet showing.
async function loadPathway(sportSlug: string) {
  return PathwayGuide.findOne({
    sportSlug: sportSlug.toLowerCase(),
    status: "published",
  }).lean();
}

/** Sort defensively — `order` is the contract, array position is not. */
function toPathwayContext(pathway: NonNullable<Awaited<ReturnType<typeof loadPathway>>>) {
  return {
    sportName: pathway.sportName,
    sportIntro: pathway.sportIntro ?? [],
    stages: [...(pathway.stages ?? [])].sort((a, b) => a.order - b.order),
  };
}

// ─── GET /api/roadmap-chat/sessions ──────────────────────────────────────────
// List all chat sessions for the authenticated user, newest first.

export const listRoadmapChatSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { sportSlug } = req.query;
    const filter: Record<string, unknown> = { userId: req.user.id };
    if (sportSlug && typeof sportSlug === "string") filter.sportSlug = sportSlug;

    const sessions = await RoadmapChatSession.find(filter)
      .select("_id sportSlug title totalMessageCount createdAt updatedAt")
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

// ─── POST /api/roadmap-chat/sessions ─────────────────────────────────────────
// Create a new blank session for a sport.

export const createRoadmapChatSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { sportSlug } = req.body;
    if (!sportSlug || typeof sportSlug !== "string") {
      res.status(400).json({ success: false, message: "sportSlug is required" });
      return;
    }

    const pathway = await loadPathway(sportSlug);
    if (!pathway) {
      res.status(404).json({ success: false, message: "No published pathway for this sport yet" });
      return;
    }

    const session = await RoadmapChatSession.create({
      sportSlug,
      userId: req.user.id,
      title: null,
      messages: [
        {
          role: "assistant",
          content: buildOpeningMessage(pathway.sportName),
          createdAt: new Date(),
        },
      ],
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

// ─── GET /api/roadmap-chat/sessions/:sessionId ───────────────────────────────
// Load a specific session by ID.

export const getRoadmapChatSession = async (req: Request, res: Response): Promise<void> => {
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

    const session = await RoadmapChatSession.findOne({
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
        sportSlug: session.sportSlug,
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

// ─── POST /api/roadmap-chat/sessions/:sessionId ──────────────────────────────
// Send a message to a specific session.

export const sendRoadmapChatSessionMessage = async (req: Request, res: Response): Promise<void> => {
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
    const stageKey: string | undefined =
      typeof req.body?.stage === "string" && req.body.stage.trim()
        ? req.body.stage.trim().toLowerCase()
        : undefined;

    if (!userMessage) {
      res.status(400).json({ success: false, message: "Message is required" });
      return;
    }
    if (userMessage.length > 2000) {
      res.status(400).json({ success: false, message: "Message too long (max 2000 characters)" });
      return;
    }

    const session = await RoadmapChatSession.findOne({
      _id: sessionId as string,
      userId: req.user.id,
    });

    if (!session) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    const pathway = await loadPathway(session.sportSlug);
    if (!pathway) {
      res.status(404).json({ success: false, message: "No published pathway for this sport yet" });
      return;
    }

    // ── Rate limit checks ──────────────────────────────────────────────────────
    const rateLimit = await checkChatRateLimit(req.user.id, session.totalMessageCount, {
      dailyReached: `You've reached today's limit of ${DAILY_MESSAGE_CAP} messages. Come back tomorrow!`,
      lifetimeReached: `You've had an in-depth conversation about this sport! Start a new chat or explore another sport.`,
    });
    if (!rateLimit.ok) {
      res.status(rateLimit.status).json({
        success: false,
        message: rateLimit.message,
        code: rateLimit.code,
      });
      return;
    }

    // ── Auto-title on first user message ──────────────────────────────────────
    const isFirstUserMessage = !session.messages.some((m) => m.role === "user");
    if (isFirstUserMessage && !session.title) {
      session.title = deriveTitle(userMessage);
    }

    // ── Build system prompt ────────────────────────────────────────────────────
    const upcomingTournaments = await getUpcomingEditions(session.sportSlug, 5).catch(() => []);
    const systemPrompt = buildRoadmapChatSystemPrompt(
      toPathwayContext(pathway),
      stageKey,
      upcomingTournaments
    );

    // ── Stream response and persist both turns ─────────────────────────────────
    await streamChatAndPersist(res, req.user.id, session, systemPrompt, userMessage);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
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
};

// ─── GET /api/roadmap-chat/:sportSlug ────────────────────────────────────────
// Gets the most recent session for a sport, or creates one (backward compat).

export const getRoadmapChat = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { sportSlug } = req.params;
    if (!sportSlug || typeof sportSlug !== "string") {
      res.status(400).json({ success: false, message: "Invalid sport" });
      return;
    }

    const pathway = await loadPathway(sportSlug);
    if (!pathway) {
      res.status(404).json({ success: false, message: "No published pathway for this sport yet" });
      return;
    }

    let session = await RoadmapChatSession.findOne({ sportSlug, userId: req.user.id })
      .sort({ updatedAt: -1 })
      .lean();

    if (!session) {
      const newSession = await RoadmapChatSession.create({
        sportSlug,
        userId: req.user.id,
        title: null,
        messages: [
          {
            role: "assistant",
            content: buildOpeningMessage(pathway.sportName),
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
        sessionId: session._id,
        messages: session.messages,
        dailyMessageCount,
        totalMessageCount: session.totalMessageCount,
        dailyRemaining: Math.max(0, DAILY_MESSAGE_CAP - dailyMessageCount),
        lifetimeRemaining: Math.max(0, LIFETIME_MESSAGE_CAP - (session.totalMessageCount || 0)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch chat session",
    });
  }
};

// ─── POST /api/roadmap-chat/:sportSlug ───────────────────────────────────────
// Backward-compat: send to the most recent session for a sport.

export const sendRoadmapChatMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { sportSlug } = req.params;
    if (!sportSlug || typeof sportSlug !== "string") {
      res.status(400).json({ success: false, message: "Invalid sport" });
      return;
    }

    const userMessage: string = (req.body?.message ?? "").trim();
    const stageKey: string | undefined =
      typeof req.body?.stage === "string" && req.body.stage.trim()
        ? req.body.stage.trim().toLowerCase()
        : undefined;

    if (!userMessage) {
      res.status(400).json({ success: false, message: "Message is required" });
      return;
    }
    if (userMessage.length > 2000) {
      res.status(400).json({ success: false, message: "Message too long (max 2000 characters)" });
      return;
    }

    const pathway = await loadPathway(sportSlug);
    if (!pathway) {
      res.status(404).json({ success: false, message: "No published pathway for this sport yet" });
      return;
    }

    let session = await RoadmapChatSession.findOne({ sportSlug, userId: req.user.id }).sort({
      updatedAt: -1,
    });

    if (!session) {
      session = await RoadmapChatSession.create({
        sportSlug,
        userId: req.user.id,
        title: null,
        messages: [
          {
            role: "assistant",
            content: buildOpeningMessage(pathway.sportName),
            createdAt: new Date(),
          },
        ],
      });
    }

    const rateLimit = await checkChatRateLimit(req.user.id, session.totalMessageCount, {
      dailyReached: `You've reached today's limit of ${DAILY_MESSAGE_CAP} messages. Come back tomorrow!`,
      lifetimeReached: `You've had an in-depth conversation about this sport! Start a new chat or explore another sport.`,
    });
    if (!rateLimit.ok) {
      res.status(rateLimit.status).json({
        success: false,
        message: rateLimit.message,
        code: rateLimit.code,
      });
      return;
    }

    const isFirstUserMessage = !session.messages.some((m) => m.role === "user");
    if (isFirstUserMessage && !session.title) {
      session.title = deriveTitle(userMessage);
    }

    const upcomingTournaments = await getUpcomingEditions(sportSlug, 5).catch(() => []);
    const systemPrompt = buildRoadmapChatSystemPrompt(
      toPathwayContext(pathway),
      stageKey,
      upcomingTournaments
    );

    await streamChatAndPersist(res, req.user.id, session, systemPrompt, userMessage);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
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
};
