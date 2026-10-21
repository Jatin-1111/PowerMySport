import { buildAssistantChatSystemPrompt } from "../../shared/services/assistantChatService";
import type { ChatToolDefinition } from "../../shared/services/chatToolsService";
import {
  CHANNEL_ADDENDUM,
  type ReplyGenerator,
} from "../../shared/services/whatsappAssistantService";
import { clipReply, formatForWhatsApp } from "../../shared/services/whatsappFormat";
import { ASSISTANT_CASES, validateCases, type AssistantCase } from "./cases";
import { fixtureFor } from "./fixtures";

/** WhatsApp's own limit with a margin, the same as production. */
const MAX_REPLY_CHARS = 3800;

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface CaseRun {
  caseId: string;
  /** What the parent would read: formatted, for WhatsApp. */
  reply: string;
  /** What the model wrote, before the WhatsApp formatter. */
  rawReply: string;
  calls: ToolCall[];
  /** True when the formatter had to change the model's reply. */
  formatterRepaired: boolean;
  error?: string;
  ms: number;
}

/**
 * The real tools' names, descriptions and schemas, with every execute replaced by a fixture
 * and a record of the call. The model is given exactly what it is given in production; only
 * the data behind it is fake.
 */
export function stubTools(
  real: readonly ChatToolDefinition[],
  record: ToolCall[]
): ChatToolDefinition[] {
  return real.map((tool) => ({
    ...tool,
    execute: async (args: Record<string, unknown>) => {
      record.push({ name: tool.name, args });
      return fixtureFor(tool.name, args);
    },
  }));
}

export type CaseGenerator = (
  systemPrompt: string,
  history: [],
  message: string,
  tools: ChatToolDefinition[]
) => AsyncIterable<string>;

export async function runCase(
  c: AssistantCase,
  realTools: readonly ChatToolDefinition[],
  generate: CaseGenerator
): Promise<CaseRun> {
  const calls: ToolCall[] = [];
  const tools = stubTools(realTools, calls);
  const whatsapp = c.channel === "whatsapp";
  const systemPrompt = buildAssistantChatSystemPrompt(tools) + (whatsapp ? CHANNEL_ADDENDUM : "");

  const started = Date.now();
  let rawReply = "";
  try {
    for await (const piece of generate(systemPrompt, [], c.message, tools)) rawReply += piece;
  } catch (err) {
    return {
      caseId: c.id,
      reply: "",
      rawReply,
      calls,
      formatterRepaired: false,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    };
  }

  rawReply = rawReply.trim();
  const reply = whatsapp ? clipReply(formatForWhatsApp(rawReply), MAX_REPLY_CHARS) : rawReply;
  return {
    caseId: c.id,
    reply,
    rawReply,
    calls,
    formatterRepaired: whatsapp && reply !== rawReply,
    ms: Date.now() - started,
  };
}

// ─── Checks that need no model ─────────────────────────────────────────────────

/** Anything shaped like a tool name: verb_noun in snake case. */
const TOOL_SHAPED = /\b(?:get|search|find|list|lookup|create|book|fetch)_[a-z][a-z_]*\b/g;

/**
 * What can be wrong without calling a model: the case file, and the prompt disagreeing with
 * the registry. The second is the check that would have caught the prompt naming a tool
 * (get_pathway_level) that was never registered.
 */
export function staticChecks(tools: readonly ChatToolDefinition[]): string[] {
  const problems = validateCases(
    ASSISTANT_CASES,
    tools.map((tool) => tool.name)
  );

  const names = tools.map((tool) => tool.name);
  const prompt = buildAssistantChatSystemPrompt(tools);

  for (const tool of tools) {
    if (!prompt.includes(tool.name)) problems.push(`prompt does not mention tool ${tool.name}`);
    if (!prompt.includes(tool.summary))
      problems.push(`prompt does not carry ${tool.name}'s summary`);
  }
  for (const mentioned of new Set(prompt.match(TOOL_SHAPED) ?? [])) {
    if (!names.includes(mentioned)) {
      problems.push(`prompt names "${mentioned}", which is not a registered tool`);
    }
  }
  const empty = buildAssistantChatSystemPrompt([]);
  for (const name of names) {
    if (empty.includes(name)) problems.push(`prompt with no tools still mentions ${name}`);
  }
  return problems;
}

export type { ReplyGenerator };
