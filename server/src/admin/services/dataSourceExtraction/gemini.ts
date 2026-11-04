import { GoogleGenAI } from "@google/genai";
import { log as __rootLog } from "../../../utils/logger";

const logger = __rootLog.child("dataSourceExtraction");

/**
 * AI extraction for admin-submitted federation/tournament data sources
 * (a link or an uploaded PDF). Replaces the retired Lane-A cron scraper —
 * this only ever writes onto the submission doc itself (`extractedData`,
 * `status`); nothing here touches the live Federation/Tournament/
 * TournamentEdition collections. That write only happens from an explicit
 * admin "approve" action in dataSourceAdminController.
 *
 * Gemini plumbing (getClient/modelCandidates/JSON parsing/urlContext
 * two-step) mirrors what tournamentCalendarService.ts used to do — that file
 * is being retired, so the pattern is duplicated here rather than imported.
 */

const isDev = process.env.NODE_ENV !== "production";

export const log = {
  // Dev-only chatter: keep it off the prod stream, but route it through the
  // real logger so it carries the namespace and request id like everything else.
  info: (message: string, ...rest: unknown[]) => {
    if (isDev) logger.info(message, ...rest);
  },
  warn: (message: string, ...rest: unknown[]) => logger.warn(message, ...rest),
  error: (message: string, ...rest: unknown[]) => logger.error(message, ...rest),
};

/**
 * Tried in order, falling through on 404/quota errors (see jsonExtractionCall).
 *
 * Ordered by free-tier requests-per-day, NOT by capability — this pipeline is
 * quota-bound, not quality-bound. gemini-3.1-flash-lite allows 500 RPD where
 * the 2.5 models allow 20, and one LINK extraction spends 2 calls per model
 * tried, so leading with the 2.5 models exhausted a day in a handful of
 * submissions. The 2.5 pair stays as fallback.
 *
 * Both features this service depends on — `responseMimeType: application/json`
 * and the `urlContext` tool — are verified present on every model listed here.
 * Notably NOT usable: antigravity-preview-05-2026 (has generous quota and
 * supports generateContent, but rejects both JSON mode and urlContext), and
 * gemini-3.5-flash / 3.5-flash-lite (urlContext browsing is restricted).
 */
const modelCandidates = ["gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

export function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/** Strips markdown fences and salvages the first balanced [...]/{...} block on parse failure. */
function parseJsonValue(text: string, kind: "array" | "object"): unknown | null {
  const trimmed = text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/i, "")
    .trim();
  const isRightShape = (v: unknown) =>
    kind === "array" ? Array.isArray(v) : v !== null && typeof v === "object" && !Array.isArray(v);

  try {
    const parsed = JSON.parse(trimmed);
    if (isRightShape(parsed)) return parsed;
  } catch {
    // fall through to salvage
  }
  const match = trimmed.match(kind === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (isRightShape(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

export interface ExtractionOutcome {
  data: unknown | null;
  model?: string;
  error?: string;
}

/**
 * Gemini surfaces failures as a raw JSON blob, which the admin UI then renders
 * verbatim in the "Error:" line — a full RESOURCE_EXHAUSTED dump tells a
 * reviewer nothing actionable. Map the cases we actually hit to plain language.
 *
 * Quota matters operationally here: the free tier allows only 20 requests per
 * day per model, and one LINK extraction spends two calls (urlContext read +
 * JSON format) per model tried — so a handful of submissions can exhaust a day.
 */
function humanizeGeminiError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted")) {
    const retry = raw.match(/retry in ([\d.]+)s/i)?.[1];
    const retryNote = retry ? ` Try again in about ${Math.ceil(Number(retry))}s.` : "";
    return `The AI provider's request quota is exhausted, so this source could not be read.${retryNote} No data was changed — use Re-extract once quota resets.`;
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return "The configured AI model is unavailable. This needs a config fix, not a retry.";
  }
  if (
    lower.includes("api key") ||
    lower.includes("permission") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return "The AI provider rejected our credentials. This needs a config fix, not a retry.";
  }
  if (lower.includes("unparseable")) {
    return "The AI returned malformed JSON for this source. Re-extract to retry, or upload the PDF instead of the link.";
  }
  // Unrecognised — keep it, but truncated so the UI stays readable.
  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
}

/** Single-step JSON extraction call — used for the format-conversion step and for PDF input. */
export async function jsonExtractionCall(
  genAI: GoogleGenAI,
  contents: string | Array<{ role: string; parts: Array<Record<string, unknown>> }>,
  kind: "array" | "object"
): Promise<ExtractionOutcome> {
  let lastError = "";
  for (const model of modelCandidates) {
    try {
      const res = await genAI.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          // A full calendar is 100+ objects; the default ceiling truncated the
          // array mid-year (38 of ~120 events came back before this was set).
          maxOutputTokens: 32768,
          // Transcribing a table needs no deliberation, and on Gemini 3.x
          // thinking tokens are drawn from the same output budget as the answer.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      const parsed = parseJsonValue((res.text ?? "").trim(), kind);
      if (parsed) return { data: parsed, model };
      lastError = "Model returned unparseable JSON.";
      log.warn(`[DataSourceExtraction] ${model} returned unparseable JSON — trying next.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      log.warn(`[DataSourceExtraction] ${model} failed:`, msg.slice(0, 200));
      const lower = msg.toLowerCase();
      if (
        !lower.includes("404") &&
        !lower.includes("not found") &&
        !lower.includes("429") &&
        !lower.includes("quota")
      ) {
        break; // unexpected error — don't burn remaining candidates
      }
    }
  }
  return { data: null, error: humanizeGeminiError(lastError || "All models failed.") };
}

/** Two-step urlContext extraction — step 1 lets Gemini fetch the URL itself (handles JS-rendered/bot-gated pages), step 2 formats the free-form findings into strict JSON. */
export async function urlContextExtraction(
  genAI: GoogleGenAI,
  url: string,
  formatPrompt: (findings: string) => string,
  kind: "array" | "object",
  focusHint?: string
): Promise<ExtractionOutcome> {
  let lastError = "";
  for (const model of modelCandidates) {
    try {
      const step1 = await genAI.models.generateContent({
        model,
        contents:
          `Open and read this page/document using your URL context tool: ${url}\n\n` +
          `Report everything relevant you find on it in plain text or bullets — do not add anything from memory or guesswork. ` +
          `If it fails to load or has nothing relevant, say so plainly.` +
          (focusHint ? `\n\n${focusHint}` : ""),
        config: { tools: [{ urlContext: {} }], temperature: 0.1 },
      });
      const findings = (step1.text ?? "").trim();
      if (!findings || findings.length < 50) {
        lastError = "urlContext returned no usable findings.";
        continue;
      }
      return await jsonExtractionCall(genAI, formatPrompt(findings), kind);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      log.warn(`[DataSourceExtraction] urlContext via ${model} failed:`, msg.slice(0, 200));
    }
  }
  return { data: null, error: humanizeGeminiError(lastError || "All models failed.") };
}
