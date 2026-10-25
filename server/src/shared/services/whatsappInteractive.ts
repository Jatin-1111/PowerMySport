/**
 * The tappable parts of the WhatsApp flow: the welcome menu, the "what next" list, the feedback
 * buttons and the link button. All pure, so what a parent can tap and what it means is pinned in
 * one place and tested without sending anything.
 *
 * Limits that shape this file (Meta's): a button title is at most 20 characters and a message has
 * at most 3 buttons; a list row title is at most 24 characters, a list at most 10 rows, its
 * button label at most 20; an interactive body is at most 1024 characters.
 */

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ReplyButton {
  id: string;
  title: string;
}

export const WELCOME_BODY =
  "Hi! Welcome to PowerMySport 👋\nWe help parents understand and guide their child's sporting journey.\n\nWhat would you like help with today? You can pick below or just type your question.";
export const WELCOME_BUTTON = "Choose a topic";

export const WELCOME_ROWS: ListRow[] = [
  { id: "menu_sport", title: "Choosing the right sport" },
  {
    id: "menu_start",
    title: "Start or improve a sport",
    description: "Getting started or improving in a sport",
  },
  { id: "menu_tournaments", title: "Tournaments & rankings" },
  {
    id: "menu_pathway",
    title: "Sports career pathways",
    description: "Sports career and future pathways",
  },
  { id: "menu_other", title: "Something else" },
];

export const NEXT_STEPS_BODY = "Would you like help taking the next step?";
export const NEXT_STEPS_BUTTON = "Next steps";

export const NEXT_STEP_ROWS: ListRow[] = [
  {
    id: "next_coach",
    title: "Find a coach or academy",
    description: "Help me find a coach or academy",
  },
  {
    id: "next_tournaments",
    title: "Explore tournaments",
    description: "Help me explore tournaments or competitions",
  },
  { id: "next_expert", title: "Speak to a sports expert" },
  { id: "next_question", title: "Ask another question" },
  { id: "next_done", title: "I'm good for now" },
];

export const FEEDBACK_BODY = "Glad I could help. Was this useful?";
export const FEEDBACK_BUTTONS: ReplyButton[] = [
  { id: "fb_helpful", title: "Yes, helpful" },
  { id: "fb_not_helpful", title: "Not really" },
];

export const FEEDBACK_THANKS_HELPFUL =
  "Thank you! Message me any time you have another question about your child's sport.";
export const FEEDBACK_THANKS_NOT_HELPFUL =
  "Sorry that didn't help. I've noted it so we can improve. You can ask me again in your own words, or reach the team at https://powermysport.com/contact";

/**
 * What a tap means. Most taps are a question for the assistant, sent in a sentence it can act on
 * (the bare row title reads as a heading, not a request). Closing and feedback are decided here,
 * with no model call, so they are instant, cost nothing and cannot be talked out of.
 */
export type Intent =
  | { kind: "ask"; text: string }
  | { kind: "followup"; assistance: "coach" | "expert"; text: string }
  | { kind: "done" }
  | { kind: "feedback"; value: "helpful" | "not_helpful" };

const ASK: Record<string, string> = {
  menu_sport: "I need help choosing the right sport for my child.",
  menu_start: "I want help getting started or improving in a sport.",
  menu_tournaments: "I have a question about tournaments and rankings.",
  menu_pathway: "I want to understand sports career pathways for my child.",
  menu_other: "I have something else to ask.",
  next_tournaments: "Help me explore tournaments or competitions for my child.",
  next_question: "I have another question.",
};

export function intentForReply(replyId: string | null | undefined): Intent | null {
  if (!replyId) return null;
  if (replyId === "next_done") return { kind: "done" };
  if (replyId === "fb_helpful") return { kind: "feedback", value: "helpful" };
  if (replyId === "fb_not_helpful") return { kind: "feedback", value: "not_helpful" };
  // Help the assistant cannot give from here: the tap is the request, so it is recorded for the
  // team straight away instead of being talked about first.
  if (replyId === "next_coach") {
    return {
      kind: "followup",
      assistance: "coach",
      text: "I'd like help finding a coach or academy for my child.",
    };
  }
  if (replyId === "next_expert") {
    return {
      kind: "followup",
      assistance: "expert",
      text: "I'd like to speak to a sports expert.",
    };
  }
  const text = ASK[replyId];
  return text ? { kind: "ask", text } : null;
}

/** A message that is only a greeting or a request for the menu, so the menu is the answer. */
export function wantsMenu(text: string): boolean {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-zऀ-ॿ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length > 24) return false;
  return /^(hi+|hello+|hey+|hii+|namaste|namaskar|start|menu|help|options|hi there|hello there|good (morning|afternoon|evening))$/.test(
    cleaned
  );
}

// ─── Asking the team to get back to the parent ───────────────────────────────

const FOLLOW_UP_WHAT = {
  coach: "that you are looking for a coach or academy",
  expert: "that you would like to speak to a sports expert",
  team: "your request",
  tournaments: "that you want help with tournaments",
  other: "your request",
} as const;

/**
 * What the parent is told once the team has been asked to follow up. The reference is theirs to
 * quote. Nothing here promises a time, because nobody has agreed one.
 */
export function followUpReply(
  kind: keyof typeof FOLLOW_UP_WHAT,
  reference: string,
  alreadyRequested = false
): string {
  const lines = alreadyRequested
    ? [
        "This is already with our team. They will get back to you here on WhatsApp with the next steps.",
        `Your reference: ${reference}`,
      ]
    : [
        `Thank you! We have noted ${FOLLOW_UP_WHAT[kind]}.`,
        "Our team will review your request and get back to you here on WhatsApp with the next steps.",
        `Your reference: ${reference}`,
      ];
  // Experts can be booked on the site straight away, so that way stays open while the team follows up.
  if (kind === "expert") {
    lines.push(
      "",
      "If you would rather not wait, you can see their open times and book here:",
      "https://powermysport.com/experts"
    );
  }
  return lines.join("\n");
}

// ─── Link button ─────────────────────────────────────────────────────────────

const LINK_LABELS: Array<[RegExp, string]> = [
  [/\/experts\/[^/\s]+/, "View expert profile"],
  [/\/experts\b/, "Browse experts"],
  [/\/guidance\b/, "Open guidance tool"],
  [/\/planner\b/, "Open the planner"],
  [/\/tournaments\b/, "See tournaments"],
  [/\/roadmap\b/, "View the roadmap"],
  [/\/assessment\b/, "Take the assessment"],
  [/\/start\b/, "Continue on website"],
  [/\/contact\b/, "Contact the team"],
  [/\/ask\b/, "Ask on the website"],
];

const SITE_URL = /https:\/\/(?:www\.)?powermysport\.com[^\s)]*/gi;
const MAX_LINK_BODY = 1000;

/**
 * Turns a reply that points at exactly one PowerMySport page into a message with a tappable button
 * instead of a long bare URL. Returns null when the reply has no such link, has several (a button
 * can carry one), or is too long for an interactive body, and the reply is then sent as plain text.
 */
export function splitLinkButton(
  reply: string
): { body: string; url: string; label: string } | null {
  const urls = [...new Set((reply.match(SITE_URL) ?? []).map((u) => u.replace(/[.,;:!?]+$/, "")))];
  if (urls.length !== 1) return null;
  const url = urls[0]!;

  const body = reply
    .replace(SITE_URL, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!body || body.length > MAX_LINK_BODY) return null;

  const label = LINK_LABELS.find(([pattern]) => pattern.test(url))?.[1] ?? "Open on PowerMySport";
  return { body, url, label };
}
