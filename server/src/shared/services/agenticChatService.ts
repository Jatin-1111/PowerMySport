import { GoogleGenAI } from "@google/genai";
import type { Content, FunctionCall, Part } from "@google/genai";
import { AiBusyError, canTryNextModel, isBusyError } from "./aiErrors";
import type { ChatToolContext, ChatToolDefinition } from "./chatToolsService";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const chatModelCandidates = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
].filter((m): m is string => Boolean(m));

// Caps the number of tool-resolution round-trips per message, so a
// misbehaving or looping model can't run up an unbounded number of Gemini
// calls (and cost) for a single user message.
const MAX_TOOL_HOPS = 3;

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

async function executeToolCalls(
  calls: FunctionCall[],
  toolsByName: Map<string, ChatToolDefinition>,
  toolContext: ChatToolContext
): Promise<Part[]> {
  const parts: Part[] = [];
  for (const call of calls) {
    const tool = call.name ? toolsByName.get(call.name) : undefined;
    let output: unknown;
    try {
      output = tool
        ? await tool.execute(call.args || {}, toolContext)
        : { error: `Unknown tool: ${call.name}` };
    } catch (toolError) {
      output = {
        error: toolError instanceof Error ? toolError.message : "Tool execution failed",
      };
    }
    parts.push({
      functionResponse: { name: call.name ?? "", response: { output } },
    });
  }
  return parts;
}

/**
 * Streams a Gemini chat response with optional function-calling.
 *
 * Turns that don't need a tool stream normally, chunk by chunk, exactly like
 * the tool-free chat path (verified empirically: a tool-call turn arrives as
 * a single complete chunk with no preceding text, so text seen before one
 * appears is always genuine — nothing is lost by bailing out on it).
 *
 * When a tool call does appear, subsequent hops run non-streamed
 * (execute → feed result back → ask again, up to MAX_TOOL_HOPS) since we
 * need to inspect each response for further calls. Once the model is done
 * calling tools, one last streamed call delivers the actual answer so the
 * user still sees it arrive incrementally.
 */
export async function* streamAgenticChatResponse(
  systemPrompt: string,
  history: ChatHistoryMessage[],
  userMessage: string,
  tools: ChatToolDefinition[] = [],
  toolContext: ChatToolContext = {}
): AsyncGenerator<string> {
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY environment variable");
  }

  const genAI = new GoogleGenAI({ apiKey });

  const contents: Content[] = [
    ...history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const toolsConfig =
    tools.length > 0
      ? {
          tools: [
            {
              functionDeclarations: tools.map((t) => ({
                name: t.name,
                description: t.description,
                parametersJsonSchema: t.parametersJsonSchema,
              })),
            },
          ],
        }
      : {};

  let lastError: unknown = null;
  // Once the parent has seen text, or a tool has run, another model cannot take
  // over cleanly: its answer would be glued onto the first one, and a tool call
  // (a team hand-off, for one) would run twice. Failing over is only safe before.
  let startedAnswering = false;
  let toolHasRun = false;

  for (const modelName of chatModelCandidates) {
    try {
      // ── Hop 0: stream normally, bail out the moment a tool call appears ──────
      const firstStream = await genAI.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.6,
          maxOutputTokens: 1024,
          ...toolsConfig,
        },
      });

      let pendingCalls: FunctionCall[] | undefined;
      let modelTurnContent: Content | undefined;

      for await (const chunk of firstStream) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          pendingCalls = chunk.functionCalls;
          modelTurnContent = chunk.candidates?.[0]?.content;
          break;
        }
        if (chunk.text) {
          startedAnswering = true;
          yield chunk.text;
        }
      }

      if (!pendingCalls) return; // No tool call — hop 0's stream WAS the full answer.

      if (modelTurnContent) contents.push(modelTurnContent);
      toolHasRun = true;
      contents.push({
        role: "user",
        parts: await executeToolCalls(pendingCalls, toolsByName, toolContext),
      });

      // ── Tool-resolution hops (non-streaming, so we can inspect for more calls) ─
      let hops = 1;
      while (hops < MAX_TOOL_HOPS) {
        const response = await genAI.models.generateContent({
          model: modelName,
          contents,
          config: { systemInstruction: systemPrompt, temperature: 0.6, ...toolsConfig },
        });

        const calls = response.functionCalls;
        if (!calls || calls.length === 0) break; // Model is done calling tools.

        const turnContent = response.candidates?.[0]?.content;
        if (turnContent) contents.push(turnContent);
        contents.push({
          role: "user",
          parts: await executeToolCalls(calls, toolsByName, toolContext),
        });
        hops++;
      }

      // ── Final hop: stream the actual answer (tools disabled to force text) ───
      const finalStream = await genAI.models.generateContentStream({
        model: modelName,
        contents,
        config: { systemInstruction: systemPrompt, temperature: 0.6, maxOutputTokens: 1024 },
      });
      for await (const chunk of finalStream) {
        if (chunk.text) {
          startedAnswering = true;
          yield chunk.text;
        }
      }
      return;
    } catch (error) {
      lastError = error;
      // A missing model, an exhausted quota or an overloaded model is worth
      // trying on the next one, as long as nothing has been shown or run yet.
      if (!startedAnswering && !toolHasRun && canTryNextModel(error)) continue;
      throw isBusyError(error) ? new AiBusyError(error) : error;
    }
  }

  if (isBusyError(lastError)) throw new AiBusyError(lastError);

  throw new Error(
    `No supported Gemini chat model found. Tried: ${chatModelCandidates.join(", ")}. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
