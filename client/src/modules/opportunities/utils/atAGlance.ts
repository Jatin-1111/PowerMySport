import { SELECTION_LABELS } from "../config/tracks";
import type { Opportunity } from "../services/opportunities";
import { costLine, cycleLine, eligibilityChips, formatAmount } from "./format";

// ─── The short answers at the top of an entry's page ────────────────────────
//
// A parent arriving on an entry asks four things before anything else: what do
// we get, is it for a child like ours, when, and how are players chosen. The
// answers already exist as fields on the entry; this reads them into short
// lines so the page can put them together instead of leaving them spread across
// four sections. Nothing here is written for the page: a field that is not set
// gives no row, rather than a guess.

export interface GlanceRow {
  label: string;
  value: string;
}

type GlanceInput = Pick<
  Opportunity,
  "benefit" | "cost" | "eligibility" | "cycle" | "cycleState" | "selection"
>;

export function glanceRows(opportunity: GlanceInput): GlanceRow[] {
  const rows: GlanceRow[] = [];

  const amount = formatAmount(opportunity.benefit?.amount);
  const gets = [opportunity.benefit?.summary, amount].filter(Boolean).join(" ");
  if (gets) rows.push({ label: "You get", value: gets });

  // Said once, and only when the entry states it: a missing cost is not "free".
  const cost = costLine(opportunity.cost);
  if (cost) rows.push({ label: "Cost", value: cost });

  // The editor's one line comes first. Without it, the age and gender rules are
  // the next best thing, and without those the rules below are the answer.
  const who = opportunity.eligibility?.summary?.trim()
    ? [opportunity.eligibility.summary.trim()]
    : eligibilityChips(opportunity.eligibility);
  rows.push({
    label: "Who can apply",
    value: who.length > 0 ? who.join(" · ") : "See the rules below",
  });

  rows.push({
    label: "When",
    // A rolling entry has no window to state. Saying so is the answer: leaving
    // the row out would read as "we forgot", and a date would be invented.
    value: cycleLine(opportunity) ?? "No deadline listed. Check the official page.",
  });

  const selection = opportunity.selection ? SELECTION_LABELS[opportunity.selection] : null;
  if (selection) rows.push({ label: "How you are chosen", value: selection.explain });

  return rows;
}

export interface PrimaryAction {
  href: string;
  label: string;
}

/**
 * The one thing a parent can do from the page: go to the official application
 * when there is one to apply to, otherwise to the official page. The entry's
 * first source is the fallback, because every published entry has at least one
 * and it is the page an editor checked the rules against.
 */
export function primaryAction(
  opportunity: Pick<Opportunity, "applyUrl" | "cycleState" | "selection" | "sources">
): PrimaryAction | null {
  const canApply =
    opportunity.applyUrl &&
    opportunity.cycleState !== "closed" &&
    (opportunity.selection === "apply" || opportunity.selection === "trials");
  if (canApply && opportunity.applyUrl) {
    return { href: opportunity.applyUrl, label: "Go to the official application" };
  }
  const source = opportunity.sources?.[0];
  return source ? { href: source.url, label: "Open the official page" } : null;
}

/**
 * Whether there is a date for an alert to be about. Following an entry only ever
 * produces an email when its window is about to open or close, so on one with no
 * dates the button would promise something that cannot happen.
 */
export function hasFollowableDates(opportunity: Pick<Opportunity, "cycle">): boolean {
  return Boolean(opportunity.cycle?.opensOn || opportunity.cycle?.closesOn);
}
