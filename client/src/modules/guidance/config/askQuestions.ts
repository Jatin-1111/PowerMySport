/**
 * The starter questions offered on the homepage's "Ask before you decide"
 * section and on the /ask page itself.
 *
 * Each is something the assistant can answer from data it looks up (pathway
 * levels, upcoming tournaments, the expert directory, the site's own pages),
 * so a click never lands on a guess. Tennis is named on purpose: it is the
 * sport with the deepest guide today.
 */
export const ASK_SUGGESTED_QUESTIONS = [
  "Help me pick a sport for my child",
  "What does the Tennis pathway look like, stage by stage?",
  "Which tennis tournaments are coming up?",
  "Can I talk to an expert about my child?",
  "How does PowerMySport work, and is it free?",
] as const;

/** Where a question goes: the /ask page, which sends it once the chat is ready. */
export function askHref(question?: string): string {
  const trimmed = question?.trim();
  return trimmed ? `/ask?q=${encodeURIComponent(trimmed)}` : "/ask";
}
