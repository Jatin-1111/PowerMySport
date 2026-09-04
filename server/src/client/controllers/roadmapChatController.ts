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
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

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

export const listRoadmapChatSessions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
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
  }
);

// ─── POST /api/roadmap-chat/sessions ─────────────────────────────────────────
// Create a new blank session for a sport.

export const createRoadmapChatSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const { sportSlug } = req.body;
    if (!sportSlug || typeof sportSlug !== "string") {
      throw new AppError("sportSlug is required", 400);
    }

    const pathway = await loadPathway(sportSlug);
    if (!pathway) {
      throw new AppError("No published pathway for this sport yet", 404);
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
  }
);

// ─── GET /api/roadmap-chat/sessions/:sessionId ───────────────────────────────
// Load a specific session by ID.

export const getRoadmapChatSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const { sessionId } = req.params;
    if (!mongoose.isValidObjectId(sessionId)) {
      throw new AppError("Invalid session ID", 400);
    }

    const session = await RoadmapChatSession.findOne({
      _id: sessionId as string,
      userId: req.user.id,
    }).lean();

    if (!session) {
      throw new AppError("Session not found", 404);
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
  }
);

// ─── POST /api/roadmap-chat/sessions/:sessionId ──────────────────────────────
// Send a message to a specific session.
//
// NOTE: this handler keeps its own try/catch. The response here is a
// server-sent-events stream (see streamChatAndPersist), so once headers are
// sent the catch must write an SSE-formatted error frame instead of a JSON
// body — that isn't something the global JSON error handler can do, so this
// isn't a case of "just log and respond" and is preserved as-is.
export const sendRoadmapChatSessionMessage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401);
      }

      const { sessionId } = req.params;
      if (!mongoose.isValidObjectId(sessionId)) {
        throw new AppError("Invalid session ID", 400);
      }

      const userMessage: string = (req.body?.message ?? "").trim();
      const stageKey: string | undefined =
        typeof req.body?.stage === "string" && req.body.stage.trim()
          ? req.body.stage.trim().toLowerCase()
          : undefined;

      if (!userMessage) {
        throw new AppError("Message is required", 400);
      }
      if (userMessage.length > 2000) {
        throw new AppError("Message too long (max 2000 characters)", 400);
      }

      const session = await RoadmapChatSession.findOne({
        _id: sessionId as string,
        userId: req.user.id,
      });

      if (!session) {
        throw new AppError("Session not found", 404);
      }

      const pathway = await loadPathway(session.sportSlug);
      if (!pathway) {
        throw new AppError("No published pathway for this sport yet", 404);
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
        res.status(error instanceof AppError ? error.statusCode : 500).json({
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

// ─── GET /api/roadmap-chat/:sportSlug ────────────────────────────────────────
// Gets the most recent session for a sport, or creates one (backward compat).

export const getRoadmapChat = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const { sportSlug } = req.params;
  if (!sportSlug || typeof sportSlug !== "string") {
    throw new AppError("Invalid sport", 400);
  }

  const pathway = await loadPathway(sportSlug);
  if (!pathway) {
    throw new AppError("No published pathway for this sport yet", 404);
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
});

// ─── POST /api/roadmap-chat/:sportSlug ───────────────────────────────────────
// Backward-compat: send to the most recent session for a sport.
//
// NOTE: same rationale as sendRoadmapChatSessionMessage above — this streams
// an SSE response, so the catch must branch on res.headersSent to send either
// a JSON error or an SSE error frame. Preserved as-is.
export const sendRoadmapChatMessage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401);
      }

      const { sportSlug } = req.params;
      if (!sportSlug || typeof sportSlug !== "string") {
        throw new AppError("Invalid sport", 400);
      }

      const userMessage: string = (req.body?.message ?? "").trim();
      const stageKey: string | undefined =
        typeof req.body?.stage === "string" && req.body.stage.trim()
          ? req.body.stage.trim().toLowerCase()
          : undefined;

      if (!userMessage) {
        throw new AppError("Message is required", 400);
      }
      if (userMessage.length > 2000) {
        throw new AppError("Message too long (max 2000 characters)", 400);
      }

      const pathway = await loadPathway(sportSlug);
      if (!pathway) {
        throw new AppError("No published pathway for this sport yet", 404);
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
        res.status(error instanceof AppError ? error.statusCode : 500).json({
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
