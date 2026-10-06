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
 * Every pair here is at least 4.5:1: white on slate-800 and on emerald-700, and dark
 * text on the pale ones.
 */

/** A small label saying what state a plan entry is in. */
export const STATUS_BADGE: Record<SeasonPlanEntryStatus, string> = {
  shortlisted: "border-slate-800 bg-slate-800 text-white",
  entered: "border-emerald-700 bg-emerald-700 text-white",
  played: "border-slate-200 bg-slate-100 text-slate-600",
};

export const SUGGESTED_BADGE = "border-orange-300 bg-orange-50 text-orange-900";
export const OPEN_BADGE = "border-slate-200 bg-white text-slate-700";
