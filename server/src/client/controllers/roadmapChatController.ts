import { Request, Response } from "express";
import { SportPathway } from "../../shared/models/SportPathway";
import { RoadmapChatSession } from "../models/RoadmapChatSession";
import { buildRoadmapChatSystemPrompt } from "../../shared/services/roadmapChatService";
import { streamGuidanceChatResponse } from "../../shared/services/guidanceChatService";
import { getUpcomingEditions } from "../../shared/services/tournamentCalendarService";
import {
  DAILY_MESSAGE_CAP,
  getDailyMessageCount,
  incrementDailyMessageCount,
  decrementDailyMessageCount,
} from "../../shared/services/chatRateLimitService";

const LIFETIME_MESSAGE_CAP = 150;

function buildOpeningMessage(sportName: string, levelLabel?: string): string {
  const levelBit = levelLabel ? ` at the ${levelLabel} level` : "";
  return `Hi! 👋 I can see you're exploring the ${sportName} roadmap${levelBit}. I'm your sports coach — ask me anything about this stage: what to do next, what it costs, how to find a coach, or what a term on this page means. What would you like to know?`;
}

// ─── GET /api/roadmap-chat/:sportSlug ─────────────────────────────────────────

export const getRoadmapChat = async (
  req: Request,
  res: Response,
): Promise<void> => {
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

    const pathway = await SportPathway.findOne({ sportSlug }).lean();
    if (!pathway) {
      res.status(404).json({ success: false, message: "Sport pathway not found" });
      return;
    }

    let session = await RoadmapChatSession.findOne({
      sportSlug,
      userId: req.user.id,
    }).lean();

    if (!session) {
      const newSession = await RoadmapChatSession.create({
        sportSlug,
        userId: req.user.id,
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

// ─── POST /api/roadmap-chat/:sportSlug ────────────────────────────────────────

export const sendRoadmapChatMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
    const level: number | undefined = req.body?.level ? Number(req.body.level) : undefined;

    if (!userMessage) {
      res.status(400).json({ success: false, message: "Message is required" });
      return;
    }
    if (userMessage.length > 2000) {
      res.status(400).json({ success: false, message: "Message too long (max 2000 characters)" });
      return;
    }

    const pathway = await SportPathway.findOne({ sportSlug }).lean();
    if (!pathway) {
      res.status(404).json({ success: false, message: "Sport pathway not found" });
      return;
    }

    let session = await RoadmapChatSession.findOne({
      sportSlug,
      userId: req.user.id,
    });

    if (!session) {
      session = await RoadmapChatSession.create({
        sportSlug,
        userId: req.user.id,
        messages: [
          {
            role: "assistant",
            content: buildOpeningMessage(pathway.sportName),
            createdAt: new Date(),
          },
        ],
      });
    }

    // ── Rate limit checks ────────────────────────────────────────────────────
    // Daily cap is global per user, shared with the guidance chat — reserved
    // atomically via Redis so concurrent requests can't both slip past the cap.
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
        message: `You've had an in-depth conversation about this sport! Ask a fresh question tomorrow or explore another sport.`,
        code: "LIFETIME_LIMIT_REACHED",
      });
      return;
    }

    // ── Build system prompt from the pathway + current level ────────────────
    // Upcoming dated editions (Lane-A calendar data) let the bot answer
    // "when is the next tournament?" with real dates instead of deflecting.
    const upcomingTournaments = await getUpcomingEditions(sportSlug, 5).catch(
      () => [],
    );
    const systemPrompt = buildRoadmapChatSystemPrompt(
      pathway,
      level,
      upcomingTournaments,
    );

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

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    // ── Persist both turns to the session ────────────────────────────────────
    const userTurn = { role: "user" as const, content: userMessage, createdAt: new Date() };
    const assistantTurn = {
      role: "assistant" as const,
      content: fullAssistantResponse,
      createdAt: new Date(),
    };

    session.messages.push(userTurn, assistantTurn);
    session.totalMessageCount += 1;
    await session.save();
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
