import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { log as __rootLog } from "../../../utils/logger";
const log = __rootLog.child("plannerAi");

/**
 * The one place the planner talks to Gemini.
 *
 * ── Model order ─────────────────────────────────────────────────────────────
 * Tried in turn, moving on when a model is missing (404) or out of quota (429),
 * the same way the guidance feature does. Names are real ones in use elsewhere in
 * this codebase: a bare "gemini-2.5" is a 404. `gemini-2.5-flash-lite` was dropped from the list on 2026-10-09: the API answers 404 "no longer available to new users", so it only added a failed call to every fallback. `PLANNER_GEMINI_MODEL` pins one
 * first without a deploy.
 *
 * Deliberately a seam: the recommendation service takes this as a parameter, so
 * tests run the whole flow with a fake model and never spend a call.
 */

/** What a call may be told beyond the prompt. */
export interface PlannerModelOptions {
  /** The events on offer. When given, the model cannot name any other. */
  slugs?: string[];
}

export type PlannerModel = (
  systemPrompt: string,
  userPrompt: string,
  options?: PlannerModelOptions
) => Promise<unknown>;

/** What a model call cost, for the evaluation harness. The page never sees it. */
export interface PlannerModelUsage {
  model: string;
  promptTokens: number | null;
  outputTokens: number | null;
}

const candidates = (): string[] =>
  [process.env.PLANNER_GEMINI_MODEL, "gemini-2.5-flash", "gemini-3.5-flash"]
    .filter((name): name is string => Boolean(name))
    .filter((name, index, all) => all.indexOf(name) === index);

/**
 * JSON mode usually returns clean JSON, but not always: one live run returned a
 * stray unquoted key. A parse failure is the model's lapse, not ours, so it moves
 * on to the next model rather than giving up on the first.
 */
const isRetryable = (message: string): boolean =>
  message.includes("json") ||
  message.includes("empty response") ||
  message.includes("404") ||
  message.includes("not found") ||
  message.includes("429") ||
  message.includes("quota") ||
  message.includes("rate limit") ||
  message.includes("too many requests");

/**
 * The shape the model must answer in, enforced by the API and not only asked for in the
 * prompt. When the offered events are known, `slug` is limited to exactly those, so an
 * invented event cannot be generated in the first place. `validate.ts` still checks all
 * of it: the schema stops mistakes, the validator proves there are none.
 */
export function responseSchemaFor(slugs: string[] | undefined): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      picks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            slug:
              slugs && slugs.length > 0
                ? { type: Type.STRING, enum: slugs }
                : { type: Type.STRING },
            tier: { type: Type.STRING, enum: ["recommended", "consider"] },
            reason: { type: Type.STRING },
          },
          required: ["slug", "tier", "reason"],
          propertyOrdering: ["slug", "tier", "reason"],
        },
      },
    },
    required: ["summary", "picks"],
    propertyOrdering: ["summary", "picks"],
  };
}

/** Low enough to keep choices steady between runs, high enough to word them plainly. */
const TEMPERATURE = 0.3;

/** Strips markdown fences, and salvages the first balanced object if the rest is noise. */
export function parseModelJson(text: string): unknown {
  const unfenced = text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced) as unknown;
  } catch (error) {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1)) as unknown;
      } catch {
        // fall through to the original error
      }
    }
    throw error;
  }
}

/** The answer, plus which model gave it and what it cost in tokens. */
export async function callPlannerModelDetailed(
  systemPrompt: string,
  userPrompt: string,
  options: PlannerModelOptions = {}
): Promise<{ value: unknown; usage: PlannerModelUsage }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY environment variable");

  const client = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  for (const model of candidates()) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: responseSchemaFor(options.slugs),
          temperature: TEMPERATURE,
        },
      });
      const text = (response.text ?? "").trim();
      if (!text) throw new Error("The model returned an empty response");
      return {
        value: parseModelJson(text),
        usage: {
          model,
          promptTokens: response.usageMetadata?.promptTokenCount ?? null,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        },
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (isRetryable(message)) {
        log.warn(`Planner model ${model} unavailable, trying the next: ${message.slice(0, 160)}`);
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No planner model was available");
}

export const callPlannerModel: PlannerModel = async (systemPrompt, userPrompt, options) =>
  (await callPlannerModelDetailed(systemPrompt, userPrompt, options)).value;
