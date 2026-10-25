/**
 * The messages the website's WhatsApp buttons pre-fill, and how the server recognises them.
 *
 * A parent who taps one of these sends the pre-filled text as their first message. None of them
 * asks anything specific ("I found you and would like to know more"), so the right answer is the
 * welcome menu, not a model's overview. The website builds its buttons from these strings and the
 * server matches against the same list, so changing a button's wording changes what the server
 * recognises and the two cannot drift apart.
 *
 * Only generic openers belong here. A button that carries a real question (a federation page, a
 * trial, a typed question) must not, or the parent would get a menu instead of an answer.
 */

export const WHATSAPP_OPENERS = {
  knowMore: "Hi! I found PowerMySport and would like to know more.",
  knowMoreGuidance:
    "Hi! I found PowerMySport and would like to know more about sports guidance for my child.",
  helpJourney: "Hi! I found PowerMySport and would like help with my child's sports journey.",
  notSureWhereToStart: "Hi! I'm not sure where to start with my child's sport.",
  haveAQuestion: "Hi! I have a question about PowerMySport.",
} as const;

/** Lower case, curly quotes straightened, punctuation dropped, spaces collapsed. */
export function normaliseOpener(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_OPENERS = new Set(Object.values(WHATSAPP_OPENERS).map(normaliseOpener));

/**
 * True when the message is exactly one of the website's generic openers, give or take case,
 * punctuation and curly quotes. Anything longer or different, including one of these with a
 * question added, is a real message and is not matched.
 */
export function isGenericWhatsAppOpener(text: string | null | undefined): boolean {
  return typeof text === "string" && GENERIC_OPENERS.has(normaliseOpener(text));
}
