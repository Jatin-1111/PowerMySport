"use client";

import { BudgetBar } from "@/modules/planner/components/BudgetBar";
import { HomeCityPrompt } from "@/modules/planner/components/HomeCityPrompt";
import type { CostResponse } from "@/modules/planner/services/planner";
import type { SeasonPlanEntry } from "@/modules/planner/services/seasonPlan";
import { formatClockTime, formatLongDate } from "@/modules/planner/utils/eventFormat";
import { nextUp, type NextUpItem } from "@/modules/planner/utils/nextUp";
import type { PlannerEdition } from "@powermysport/shared-types";
import { ExternalLink } from "lucide-react";

/**
 * The season at a glance: what to do next, where the plan stands, and what it may
 * cost. Three tiles, each answering one question a parent comes to the page with.
 *
 * Every figure here is counted from the plan or printed by AITA. Nothing is a score,
 * a streak or a number made to look like progress.
 */

const LABEL = "text-[11px] font-bold uppercase tracking-wider";

function whenText(item: NextUpItem): string {
  if (item.underWay) return "Under way";
  if (item.daysAway === 0) return "Today";
  if (item.daysAway === 1) return "Tomorrow";
  return `In ${item.daysAway} days`;
}

/** The headline for one thing to do or watch, in the words a parent would use. */
function headline(item: NextUpItem): string {
  const day = formatLongDate(item.date);
  const time = item.time ? `, ${formatClockTime(item.time)}` : "";
  if (item.kind === "enter-by") return `Entries close ${day}${time}`;
  if (item.kind === "withdraw-by") return `Last day to withdraw ${day}${time}`;
  return item.underWay ? "Under way now" : `Starts ${day}`;
}

function NextUpTile({
  items,
  childName,
  openCount,
  onOpen,
  onSuggest,
  suggesting,
  onBrowse,
}: {
  items: NextUpItem[];
  childName: string;
  /** Events open to the child, for the empty state. */
  openCount: number;
  onOpen: (slug: string) => void;
  /** The empty state's main action: make a suggested season. */
  onSuggest: () => void;
  suggesting: boolean;
  /** The empty state's other action: look through everything open. */
  onBrowse: () => void;
}) {
  const [first, ...rest] = items;
  return (
    <section
      aria-labelledby="next-up"
      data-tour="next"
      className="rounded-lg border border-slate-900 bg-slate-900 p-4 text-white"
    >
      <h2 id="next-up" className={`${LABEL} text-slate-300`}>
        {first ? "Do this next" : "Next step"}
      </h2>

      {first ? (
        <div className="mt-2">
          <p className="font-title text-xl font-extrabold leading-snug">{headline(first)}</p>
          <p className="mt-1 text-sm text-slate-200">
            <button
              type="button"
              onClick={() => onOpen(first.slug)}
              className="font-semibold underline decoration-slate-500 underline-offset-2 hover:decoration-white"
            >
              {first.name}
            </button>
            , {whenText(first).toLowerCase()}
          </p>
          {first.kind === "withdraw-by" && (
            <p className="mt-1 text-xs text-slate-300">
              After that, withdrawing counts as a late withdrawal.
            </p>
          )}
          {first.pageUrl && (
            <a
              href={first.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${first.name} on AITA`}
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-500 px-3 text-sm font-semibold text-white hover:border-white hover:bg-slate-800"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {first.kind === "enter-by" ? "Enter on AITA" : "Open on AITA"}
            </a>
          )}

          {rest.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-slate-700 pt-3 text-sm text-slate-200">
              {rest.map((item) => (
                <li key={`${item.kind}-${item.slug}`} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {headline(item)}
                    <span className="text-slate-400"> · </span>
                    <button
                      type="button"
                      onClick={() => onOpen(item.slug)}
                      className="underline decoration-slate-600 underline-offset-2 hover:decoration-white"
                    >
                      {item.name}
                    </button>
                  </span>
                  <span className="shrink-0 text-slate-400">{whenText(item)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <p className="font-title text-xl font-extrabold leading-snug">
            Pick tournaments for {childName}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">
            {openCount > 0
              ? `${openCount} tournament${openCount === 1 ? " is" : "s are"} open to ${childName}. Ask for a suggested season, or look through them all.`
              : "Nothing is open to enter right now. AITA publishes about ten weeks ahead, so this fills in."}
          </p>
          {openCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={suggesting}
                onClick={onSuggest}
                className="inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-70"
              >
                {suggesting ? "Working on it..." : "Suggest my season"}
              </button>
              <button
                type="button"
                onClick={onBrowse}
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-500 px-4 text-sm font-semibold text-white hover:border-white hover:bg-slate-800"
              >
                Browse all {openCount}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BudgetTile({
  costs,
  costsLoading,
  costsFailed,
  saveHomeCity,
}: {
  costs: CostResponse | null;
  costsLoading: boolean;
  costsFailed: boolean;
  saveHomeCity: { saving: boolean; save: (city: string) => void };
}) {
  return (
    <section
      aria-labelledby="budget-tile"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 id="budget-tile" className={`${LABEL} text-slate-500`}>
        What it may cost
      </h2>
      <div className="mt-2">
        {costs ? (
          <BudgetBar season={costs.season} />
        ) : (
          <p className="text-xs leading-relaxed text-slate-600">
            {costsLoading
              ? "Estimating what the season may cost..."
              : costsFailed
                ? "Cost estimates are not available just now. Everything else still works."
                : ""}
          </p>
        )}
      </div>
      {costs && (
        <div className="mt-3 border-t border-slate-100 pt-3 text-xs">
          <HomeCityPrompt
            bare
            origin={costs.origin}
            saving={saveHomeCity.saving}
            onSave={saveHomeCity.save}
          />
        </div>
      )}
    </section>
  );
}

export function SeasonSummary({
  entries,
  calendar,
  childName,
  openCount,
  costs,
  costsLoading,
  costsFailed,
  saveHomeCity,
  onOpenEvent,
  onSuggest,
  suggesting,
  onBrowse,
}: {
  entries: SeasonPlanEntry[];
  calendar: Map<string, PlannerEdition>;
  childName: string;
  openCount: number;
  costs: CostResponse | null;
  costsLoading: boolean;
  costsFailed: boolean;
  saveHomeCity: { saving: boolean; save: (city: string) => void };
  onOpenEvent: (slug: string) => void;
  onSuggest: () => void;
  suggesting: boolean;
  onBrowse: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const items = nextUp({ entries, calendar, today });

  // What a season may cost means nothing until there is a season. An empty plan gets
  // one box with one job instead of a box about money beside it.
  const planned = entries.length > 0;

  return (
    <div
      aria-label="What to do next"
      className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto"
    >
      <NextUpTile
        items={items}
        childName={childName}
        openCount={openCount}
        onOpen={onOpenEvent}
        onSuggest={onSuggest}
        suggesting={suggesting}
        onBrowse={onBrowse}
      />
      {planned && (
        <BudgetTile
          costs={costs}
          costsLoading={costsLoading}
          costsFailed={costsFailed}
          saveHomeCity={saveHomeCity}
        />
      )}
    </div>
  );
}
