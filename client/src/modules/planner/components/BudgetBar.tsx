"use client";

import type { SeasonCost } from "@/modules/planner/services/planner";
import { formatInr, formatRange } from "@/modules/planner/utils/money";

/**
 * The plan's travel and stay against the budget the parent set.
 *
 * The sentence comes first and the bar second: the bar is a picture of the same
 * fact and carries a text alternative, so nobody has to read a graphic to learn
 * whether the plan fits. The bar shows the range (a solid part for the low
 * estimate, a lighter part up to the high one) and a marker for the budget.
 *
 * It never says "you will spend". The figures are estimates and the top of the
 * range is the planning number.
 */

const STATUS_LINE: Record<SeasonCost["status"], (season: SeasonCost) => string> = {
  within: () => "The plan is within your budget, even at the top of the range.",
  "may-exceed": (season) =>
    `The plan may go over your budget: it could reach ${formatInr(season.total!.high)} against ${formatInr(season.budget!)}.`,
  over: () => "The plan is over your budget even at the low end of the estimates.",
  none: () => "Set a season budget in Planning preferences to compare the plan with it.",
};

export function BudgetBar({ season }: { season: SeasonCost }) {
  if (!season.total) {
    return (
      <p className="text-xs leading-relaxed text-slate-600">
        {season.events === 0
          ? "Add events to the plan to see what the season may cost."
          : "No travel and stay figures for the plan yet."}
      </p>
    );
  }

  const { total, budget } = season;
  const scale = Math.max(total.high, budget ?? 0) || 1;
  const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  const tone =
    season.status === "over"
      ? "bg-red-600"
      : season.status === "may-exceed"
        ? "bg-amber-600"
        : "bg-emerald-700";
  const toneSoft =
    season.status === "over"
      ? "bg-red-200"
      : season.status === "may-exceed"
        ? "bg-amber-200"
        : "bg-emerald-200";

  return (
    <div>
      <p className="text-sm text-slate-800">
        <span className="font-semibold">
          Season travel and stay {formatRange(total.low, total.high)}
        </span>
        <span className="text-slate-500">
          {" "}
          for {season.events} event{season.events === 1 ? "" : "s"}
        </span>
      </p>

      {budget !== null && (
        <div
          role="img"
          aria-label={`Estimated ${formatRange(total.low, total.high)} against a budget of ${formatInr(budget)}`}
          className="relative mt-2 h-3 w-full rounded-sm bg-slate-100"
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-sm ${toneSoft}`}
            style={{ width: pct(total.high) }}
          />
          <div
            className={`absolute inset-y-0 left-0 rounded-sm ${tone}`}
            style={{ width: pct(total.low) }}
          />
          <div
            className="absolute -inset-y-1 w-0.5 bg-slate-900"
            style={{ left: pct(budget) }}
            title={`Budget ${formatInr(budget)}`}
          />
        </div>
      )}

      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        {STATUS_LINE[season.status](season)}
      </p>

      {season.withoutFigures > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          {season.withoutFigures} event{season.withoutFigures === 1 ? " has" : "s have"} no travel
          and stay figure yet and {season.withoutFigures === 1 ? "is" : "are"} not in this total.
        </p>
      )}
      {season.missingEntryFees > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Entry fees are not included for {season.missingEntryFees} event
          {season.missingEntryFees === 1 ? "" : "s"}. AITA has not published a fee for{" "}
          {season.missingEntryFees === 1 ? "it" : "them"}, so add{" "}
          {season.missingEntryFees === 1 ? "it" : "them"} from the fact sheet to complete the total.
        </p>
      )}
    </div>
  );
}
