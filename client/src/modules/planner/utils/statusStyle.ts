import type { SeasonPlanEntryStatus } from "@/modules/planner/services/seasonPlan";

/**
 * How each state an event can be in is coloured, in one place.
 *
 * The calendar bars, the plan rows, the detail panel and the summary all show the
 * same three facts about an event (it is on the plan, it has been entered, it has
 * been played) and used to colour them three different ways, so entered was amber on
 * the plan and green on the calendar. These are the one answer.
 *
 *   on the plan  dark slate: a decision the parent has made
 *   entered      green with a tick: done, and confirmed
 *   played       muted: finished
 *   suggested    orange, dashed edge on the calendar: a proposal, not a decision
 *   open         white with a slate edge: available, and quiet
 *
 * The calendar bars are solid (dark slate for the plan, emerald for entered) because a
 * bar has to read at a glance across a grid. The labels beside an event's name are soft
 * tints of the same hues: amber while it still needs doing, green once it is done, grey
 * when it is over. Every pair here is at least 4.5:1: dark text on the pale fills.
 */

/** A small label saying what state a plan entry is in. */
export const STATUS_BADGE: Record<SeasonPlanEntryStatus, string> = {
  shortlisted: "border-amber-300 bg-amber-50 text-amber-950",
  entered: "border-emerald-300 bg-emerald-50 text-emerald-900",
  played: "border-hairline bg-paper-deep text-ink-body",
};

export const SUGGESTED_BADGE = "border-orange-300 bg-orange-50 text-orange-900";
export const OPEN_BADGE = "border-slate-200 bg-white text-slate-700";
