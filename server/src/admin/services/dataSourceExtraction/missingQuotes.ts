import type { getClient, jsonExtractionCall } from "./gemini";

// ─── Asking for the quotes the first reading left out ───────────────────────
//
// A reading returns values and, for each, a quote that backs it. Which values the
// model quotes varies from one reading of the same page to the next: IKF came back
// with a quote for every field the first time, and none for its steps and its
// good-to-know the second. The approval rules require a quote behind every field
// (opportunityApprovalPolicy.ts), so that variance turned a reading that was nearly
// right into one held for a person.
//
// This asks again, for just the fields that have none, and only when we hold the
// text the model read, which is what a quote is checked against. It adds no trust:
//
//   - a quote it returns is checked by the same mechanical test as any other, so one
//     it invented is not in the text and fails (quoteCheck.ts);
//   - a value the source does not support gets null, stays unquoted, and the item
//     stays held, which is the right outcome for a value the source does not state.
//
// It costs one more model call, and only for a reading that has fields missing quotes.

const MAX_TEXT_CHARS = 150_000;
const MAX_QUOTE_CHARS = 300;

/** The top-level fields that have a value and no quote. */
export function fieldsMissingQuotes(
  fields: Record<string, unknown>,
  citations: Record<string, string>
): string[] {
  return Object.keys(fields).filter((field) => !citations[field]);
}

export const secondPassEnabled = (): boolean => process.env.OPPORTUNITY_QUOTE_SECOND_PASS !== "off";

export interface CompleteCitationsInput {
  client: NonNullable<ReturnType<typeof getClient>>;
  call: typeof jsonExtractionCall;
  fields: Record<string, unknown>;
  citations: Record<string, string>;
  /** The text the model read. Without it there is nothing to quote from, so nothing is asked. */
  sourceText: string | null;
}

export interface CompleteCitationsResult {
  citations: Record<string, string>;
  /** The fields it asked about. */
  asked: string[];
  /** The fields it got a quote for (not yet checked against the text). */
  added: string[];
}

/** The citations, with a quote added for each field that lacked one and that the model could quote. */
export async function completeCitations(
  input: CompleteCitationsInput
): Promise<CompleteCitationsResult> {
  const missing = fieldsMissingQuotes(input.fields, input.citations);
  const unchanged = { citations: input.citations, asked: [] as string[], added: [] as string[] };
  if (!secondPassEnabled() || missing.length === 0) return unchanged;
  if (!input.sourceText || input.sourceText.length < 200) return unchanged;

  const asked: Record<string, unknown> = {};
  for (const field of missing) asked[field] = input.fields[field];

  const prompt = `You are checking an extraction against its source. For each field below, find a direct quote in the source text that supports the value. Rules:
- Copy the quote exactly as it appears in the source text, under 25 words. Never paraphrase, shorten with "...", or combine separate passages.
- If the source text does not support the value, return null for that field. Do not guess, and do not use what you know from elsewhere.
- Return ONLY a JSON object of this form: {"_citations": {"<field>": "<exact quote>" or null}}. No markdown, no commentary.

Fields and the values extracted for them:
${JSON.stringify(asked)}

Source text:
"""
${input.sourceText.slice(0, MAX_TEXT_CHARS)}
"""`;

  let read: Awaited<ReturnType<typeof jsonExtractionCall>>;
  try {
    read = await input.call(input.client, prompt, "object");
  } catch {
    return { ...unchanged, asked: missing };
  }
  const returned =
    read.data && typeof read.data === "object" && !Array.isArray(read.data)
      ? (read.data as Record<string, unknown>)._citations
      : undefined;
  if (!returned || typeof returned !== "object" || Array.isArray(returned)) {
    return { ...unchanged, asked: missing };
  }

  const citations = { ...input.citations };
  const added: string[] = [];
  for (const field of missing) {
    const quote = (returned as Record<string, unknown>)[field];
    if (typeof quote === "string" && quote.trim()) {
      citations[field] = quote.trim().slice(0, MAX_QUOTE_CHARS);
      added.push(field);
    }
  }
  return { citations, asked: missing, added };
}
