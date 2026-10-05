import { GoogleGenAI } from "@google/genai";
import { log as __rootLog } from "../../../utils/logger";
const log = __rootLog.child("plannerAi");

/**
 * The one place the planner talks to Gemini.
 *
 * ── Model order ─────────────────────────────────────────────────────────────
 * Tried in turn, moving on when a model is missing (404) or out of quota (429),
 * the same way the guidance feature does. Names are real ones in use elsewhere in
 * this codebase: a bare "gemini-2.5" is a 404. `PLANNER_GEMINI_MODEL` pins one
 * first without a deploy.
 *
 * Deliberately a seam: the recommendation service takes this as a parameter, so
 * tests run the whole flow with a fake model and never spend a call.
 */

export type PlannerModel = (systemPrompt: string, userPrompt: string) => Promise<unknown>;

const candidates = (): string[] =>
  [
    process.env.PLANNER_GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash-lite",
  ]
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

export const callPlannerModel: PlannerModel = async (systemPrompt, userPrompt) => {
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
          temperature: TEMPERATURE,
        },
      });
      const text = (response.text ?? "").trim();
      if (!text) throw new Error("The model returned an empty response");
      return parseModelJson(text);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (isRetryable(message)) {
        log.warn(`Planner model ${model} unavailable, trying the next`);
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No planner model was available");
};
