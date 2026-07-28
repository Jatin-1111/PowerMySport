import { Response } from "express";
import { decrementDailyMessageCount } from "./chatRateLimitService";
import { streamGuidanceChatResponse } from "./guidanceChatService";
import { streamAgenticChatResponse } from "./agenticChatService";
import type { ChatToolDefinition } from "./chatToolsService";
import type { ChatMessage } from "../../client/models/GuidanceChatSession";

export interface ChatPersistableSession {
  messages: ChatMessage[];
  totalMessageCount: number;
  save(): Promise<unknown>;
}

/**
 * Streams a Gemini chat response over SSE and persists both turns to the
 * session once complete. Shared by every AI chat feature (guidance chat,
 * roadmap chat, the general assistant, ...) so the SSE framing and
 * persistence behavior stay identical. On an AI failure, releases the
 * reserved daily-cap slot and ends the stream with an error event instead of
 * persisting anything.
 *
 * Pass `tools` to enable function-calling (see agenticChatService) — omit it
 * for the plain single-shot generation every persona used before.
 */
export async function streamChatAndPersist(
  res: Response,
  userId: string,
  session: ChatPersistableSession,
  systemPrompt: string,
  userMessage: string,
  tools?: ChatToolDefinition[],
): Promise<void> {
  const historyForAI = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let fullAssistantResponse = "";

  const responseStream = tools?.length
    ? streamAgenticChatResponse(systemPrompt, historyForAI, userMessage, tools)
    : streamGuidanceChatResponse(systemPrompt, historyForAI, userMessage);

  try {
    for await (const chunk of responseStream) {
      fullAssistantResponse += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
  } catch (aiError) {
    await decrementDailyMessageCount(userId);
    res.write(
      `data: ${JSON.stringify({ error: aiError instanceof Error ? aiError.message : "AI error" })}\n\n`,
    );
    res.end();
    return;
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();

  session.messages.push(
    { role: "user", content: userMessage, createdAt: new Date() },
    { role: "assistant", content: fullAssistantResponse, createdAt: new Date() },
  );
  session.totalMessageCount += 1;
  await session.save();
}
