import type { PlannerEntry } from "@powermysport/shared-types";
import { PlannerService, type PlannerOverview } from "./PlannerService";
import { RecommendationService } from "./plannerRecommendations/RecommendationService";
import type { RecommendationResult } from "./plannerRecommendations/types";
import { RankingClaimService } from "./RankingClaimService";

/**
 * The planner, as the assistant chat sees it.
 *
 * ── Why the chat reads this instead of the calendar ─────────────────────────
 * Before this, both chats named "the next five events" for a sport. That list
 * knows nothing about the child, so the chat could recommend an event the
 * planner page showed as closed to them. A parent who gets two answers to one
 * question trusts neither. The chat now reads the same `PlannerService` output
 * the page renders, so the two cannot disagree: there is one set of verdicts.
 *
 * ── What is deliberately left out ───────────────────────────────────────────
 * Only a first name, the list and rank, and the events. No date of birth (the
 * server never holds one after the ranking claim), no registration number, no
 * contact details. The model is told what it needs to answer, and nothing it
 * could repeat that a parent would not expect it to know.
 *
 * Behind `PLANNER_CHAT=on`, because the chat is live and its answers change.
 */

export const plannerChatEnabled = (): boolean => process.env.PLANNER_CHAT === "on";

/** Enough to answer "what is next", short enough not to crowd out the question. */
const MAX_OPEN = 8;
const MAX_CLOSED = 5;
const MAX_CHILDREN = 3;

export interface PlannerChatEvent {
  name: string;
  starts: string;
  ends?: string;
  where?: string;
  level?: string;
  entryDeadline: string;
  playingUp?: boolean;
  caveats?: string[];
}

export interface PlannerChatSummary {
  child: string;
  list: string;
  rank: number;
  listAsOn: string;
  yearlyEntryAllowance: number | null;
  openToEnter: PlannerChatEvent[];
  moreOpenInOwnGroup: number;
  openInOlderGroup: number;
  needFactSheetCheck: number;
  cannotEnter: Array<{ name: string; why: string }>;
  onTheirPlan: Array<{ name: string; starts: string; status: string }>;
  /**
   * The season the parent was shown at /planner, present only while it still
   * matches their child's situation. The chat quotes it and never makes its own.
   */
  suggestedSeason?: {
    madeBy: "an AI model, checked against the entry rules" | "the planner's rules";
    goal: string;
    summary: string;
    picks: Array<{ name: string; advice: "recommended" | "worth considering"; why: string }>;
  };
}

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fmt = (iso: string): string => DATE.format(new Date(iso));

const toEvent = (entry: PlannerEntry): PlannerChatEvent => {
  const { edition } = entry;
  const where = [edition.city, edition.state].filter(Boolean).join(", ");
  return {
    name: edition.name,
    starts: fmt(edition.startDate),
    ...(edition.endDate ? { ends: fmt(edition.endDate) } : {}),
    ...(where ? { where } : {}),
    ...(edition.ladder ? { level: edition.ladder } : {}),
    // Said, not omitted: a missing deadline must not read as "no deadline".
    entryDeadline: edition.registrationDeadlineDate
      ? fmt(edition.registrationDeadlineDate)
      : "not published",
    ...(entry.playingUp ? { playingUp: true } : {}),
    ...(entry.notes.length ? { caveats: entry.notes } : {}),
  };
};

/**
 * One child's overview as the compact record the model reads. Null when there
 * are no verdicts to give (no link, or no junior list), so a caller never has to
 * guess what an empty summary means.
 */
export function summarizePlanner(
  overview: PlannerOverview,
  suggestion: RecommendationResult | null = null
): PlannerChatSummary | null {
  if (overview.linkState !== "ready" || !overview.standing || !overview.shortlist) return null;
  const { standing, shortlist } = overview;

  return {
    child: overview.dependentName.split(/\s+/)[0] || "Your child",
    list: `${standing.category} ${standing.subcategory}`,
    rank: standing.rank,
    listAsOn: fmt(standing.asOnDate.toISOString()),
    yearlyEntryAllowance: overview.annualEntryCap,
    openToEnter: shortlist.ownGroup.slice(0, MAX_OPEN).map(toEvent),
    moreOpenInOwnGroup: Math.max(0, shortlist.ownGroup.length - MAX_OPEN),
    openInOlderGroup: shortlist.playingUp.length,
    needFactSheetCheck: shortlist.unknown.length,
    cannotEnter: shortlist.closed
      .slice(0, MAX_CLOSED)
      .map((entry) => ({ name: entry.edition.name, why: entry.reason })),
    onTheirPlan: overview.plan.entries.map((entry) => ({
      name: entry.name,
      starts: fmt(new Date(entry.startDate).toISOString()),
      status: entry.status,
    })),
    ...(suggestion && suggestion.items.length > 0
      ? { suggestedSeason: toSuggestedSeason(suggestion, overview) }
      : {}),
  };
}

function toSuggestedSeason(
  suggestion: RecommendationResult,
  overview: PlannerOverview
): NonNullable<PlannerChatSummary["suggestedSeason"]> {
  const names = new Map(
    (overview.shortlist?.ownGroup ?? [])
      .filter((entry) => entry.edition.slug)
      .map((entry) => [entry.edition.slug!, entry.edition.name])
  );
  return {
    madeBy:
      suggestion.source === "ai"
        ? "an AI model, checked against the entry rules"
        : "the planner's rules",
    goal: suggestion.goal,
    summary: suggestion.summary,
    picks: suggestion.items
      .filter((item) => names.has(item.slug))
      .map((item) => ({
        name: names.get(item.slug)!,
        advice:
          item.tier === "recommended" ? ("recommended" as const) : ("worth considering" as const),
        why: item.reason,
      })),
  };
}

/**
 * The rules the model must follow when it speaks from this data. They live next
 * to the data so the two cannot be separated: every surface that shows the
 * summaries shows these with them.
 */
export const PLANNER_CHAT_RULES = [
  "Recommend tournaments ONLY from each child's openToEnter list. Never suggest an event listed under cannotEnter, and never invent an event, date or entry rule that is not in this data.",
  'Say "open to enter", never "they will get in": above Championship Series a draw is cut by ranking and a place is earned.',
  'If an entry deadline says "not published", say the deadline is not published and point to the event\'s fact sheet. Do not guess one.',
  "Dates can change. Mention the list date (listAsOn) when you quote a rank or a verdict.",
  "Playing up uses the same yearly entry allowance as the child's own age group.",
  "If a child has suggestedSeason, that is the season the parent was already shown at /planner. Quote it and do not make up a different one. If it is absent, do not invent a season plan: describe what is open to enter and point the parent to /planner for suggestions.",
  "The parent can see all of this, with calendar links, on the planner page at /planner.",
].join("\n- ");

/** The block placed in a system prompt. */
export function formatPlannerForPrompt(summaries: PlannerChatSummary[]): string {
  return `## This parent's children and the tournaments each can enter
These are the planner's own verdicts, the same ones the parent sees at /planner. Use them in place of any general list of upcoming events.

${JSON.stringify(summaries, null, 2)}

Rules for using this:
- ${PLANNER_CHAT_RULES}`;
}

/**
 * The summaries for a signed-in parent's children in one sport, or null when
 * there is nothing personal to say (flag off, no linked child, or no junior
 * standing). `childName` narrows to one child by first name, case-insensitively.
 *
 * Reads through `PlannerService.forDependent`, so ownership is checked the same
 * way it is for the page. A failure on one child drops that child, not the answer.
 */
export async function loadPlannerChatContext(
  userId: string,
  sportSlug: string,
  childName?: string
): Promise<PlannerChatSummary[] | null> {
  if (!plannerChatEnabled()) return null;

  const claims = (await RankingClaimService.list(userId)).filter(
    (claim) => claim.sportSlug === sportSlug && claim.standings.length > 0
  );
  if (claims.length === 0) return null;

  const wanted = childName?.trim().toLowerCase();
  const chosen = wanted
    ? claims.filter((claim) => (claim.dependentName ?? "").toLowerCase().startsWith(wanted))
    : claims;

  const summaries: PlannerChatSummary[] = [];
  for (const claim of chosen.slice(0, MAX_CHILDREN)) {
    try {
      const summary = summarizePlanner(
        await PlannerService.forDependent(userId, claim.dependentId)
      );
      if (summary) summaries.push(summary);
    } catch {
      // One child failing must not take the others, or the reply, down with it.
    }
  }
  return summaries.length > 0 ? summaries : null;
}
