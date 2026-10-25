import Anthropic from "@anthropic-ai/sdk";
import { AiBusyError, isBusyError } from "./aiErrors";
import type { ChatHistoryMessage } from "./agenticChatService";
import type { ChatToolContext, ChatToolDefinition } from "./chatToolsService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("claudeChat");

/**
 * The assistant's chat loop on Claude, with the same shape as `streamAgenticChatResponse`
 * (Gemini): the system prompt, the history, the parent's message and the tools go in, and the
 * answer comes out as text. A caller can therefore use either one without knowing which.
 *
 * It exists so Claude can be compared with Gemini on the same cases (the eval), and so it can
 * take over when Gemini is out of quota. Nothing about the tools changes: their names,
 * descriptions and JSON schemas are passed through as they are.
 *
 * Choices worth knowing:
 *   - Text the model writes before a tool call is dropped, as with Gemini: a parent should read
 *     the answer, not "let me check".
 *   - The whole assistant turn is sent back after a tool call, thinking blocks included. The API
 *     requires that, and it drops them silently if the model changed.
 *   - No `temperature` and no forced `tool_choice`: the newer Claude models reject both.
 *   - Tool calls are capped (as with Gemini); after the cap one last request is made with tools
 *     switched off, so the parent still gets an answer.
 *   - The system prompt is marked for caching. Most of every request is the same fixed prompt
 *     and tool list, and cached input is a tenth of the price.
 */

export const DEFAULT_CLAUDE_MODEL = "claude-haiku-5-5";
const MAX_TOOL_HOPS = 3;
const MAX_TOKENS = 2000;

export type ClaudeEffort = "low" | "medium" | "high";

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** The one method of the SDK client that is used, so a test can replace it. */
export interface ClaudeClientLike {
  messages: {
    create(params: Record<string, unknown>): Promise<Anthropic.Message>;
  };
}

export interface ClaudeChatOptions {
  model?: string;
  effort?: ClaudeEffort;
  client?: ClaudeClientLike;
  /** Called after every request with what it used, for cost reporting. */
  onUsage?: (usage: ClaudeUsage) => void;
}

let sharedClient: ClaudeClientLike | null = null;

function clientFromEnv(): ClaudeClientLike {
  if (sharedClient) return sharedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  sharedClient = new Anthropic({ apiKey }) as unknown as ClaudeClientLike;
  return sharedClient;
}

const effortFromEnv = (): ClaudeEffort => {
  const value = process.env.CLAUDE_CHAT_EFFORT;
  return value === "medium" || value === "high" ? value : "low";
};

/** Rate limits and overload are worth another provider; a bad key or a bad request is not. */
function asProviderError(error: unknown): unknown {
  if (error instanceof Anthropic.RateLimitError || isBusyError(error))
    return new AiBusyError(error);
  return error;
}

async function runTools(
  blocks: Anthropic.ToolUseBlock[],
  toolsByName: Map<string, ChatToolDefinition>,
  toolContext: ChatToolContext
): Promise<Anthropic.ToolResultBlockParam[]> {
  // Tools in one turn are independent, so they run together; every result goes back in one message.
  return Promise.all(
    blocks.map(async (block): Promise<Anthropic.ToolResultBlockParam> => {
      const tool = toolsByName.get(block.name);
      if (!tool) {
        return {
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: JSON.stringify({ error: `Unknown tool: ${block.name}` }),
        };
      }
      try {
        const output = await tool.execute(
          (block.input ?? {}) as Record<string, unknown>,
          toolContext
        );
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(output ?? null),
        };
      } catch (error) {
        return {
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: JSON.stringify({
            error: error instanceof Error ? error.message : "Tool execution failed",
          }),
        };
      }
    })
  );
}

const textOf = (message: Anthropic.Message): string =>
  message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

export async function* streamClaudeChatResponse(
  systemPrompt: string,
  history: ChatHistoryMessage[],
  userMessage: string,
  tools: ChatToolDefinition[] = [],
  toolContext: ChatToolContext = {},
  options: ClaudeChatOptions = {}
): AsyncGenerator<string> {
  const client = options.client ?? clientFromEnv();
  const model = options.model ?? process.env.CLAUDE_CHAT_MODEL ?? DEFAULT_CLAUDE_MODEL;
  const effort = options.effort ?? effortFromEnv();
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  const toolParams = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parametersJsonSchema,
  }));

  const messages: Anthropic.MessageParam[] = [
    ...history.map((message) => ({ role: message.role, content: message.content })),
    { role: "user" as const, content: userMessage },
  ];

  // A model can finish a turn after its tool results with no words, having already said it
  // (or, after a silent tool, believing nothing is left to say). It is asked once to reply.
  let askedForAnswer = false;

  for (let hop = 0; ; hop += 1) {
    // After the last allowed round of tool calls, one more request with tools off.
    const toolsOff = hop >= MAX_TOOL_HOPS;
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages,
        output_config: { effort },
        ...(toolParams.length > 0
          ? { tools: toolParams, ...(toolsOff ? { tool_choice: { type: "none" } } : {}) }
          : {}),
      });
    } catch (error) {
      throw asProviderError(error);
    }

    options.onUsage?.({
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    });

    if (response.stop_reason === "refusal") {
      // The caller turns an empty answer into its own fallback reply.
      log.warn("the model declined to answer");
      return;
    }

    const calls = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (response.stop_reason === "tool_use" && calls.length > 0 && !toolsOff) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: await runTools(calls, toolsByName, toolContext) });
      continue;
    }

    const answer = textOf(response);
    if (answer) {
      yield answer;
      return;
    }
    const last = messages[messages.length - 1];
    if (!askedForAnswer && last?.role === "user" && Array.isArray(last.content)) {
      askedForAnswer = true;
      // Same user message as the tool results, so the turn order stays valid.
      last.content.push({ type: "text", text: "Now write your answer to the parent." });
      continue;
    }
    return;
  }
}
