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
  openCount,
  onOpen,
}: {
  items: NextUpItem[];
  /** Events open to the child, for the empty state. */
  openCount: number;
  onOpen: (slug: string) => void;
}) {
  const [first, ...rest] = items;
  return (
    <section
      aria-labelledby="next-up"
      className="rounded-lg border border-slate-900 bg-slate-900 p-4 text-white lg:col-span-5"
    >
      <h2 id="next-up" className={`${LABEL} text-slate-300`}>
        Next up
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
          <p className="font-title text-xl font-extrabold leading-snug">Nothing planned yet</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">
            {openCount > 0
              ? `${openCount} event${openCount === 1 ? " is" : "s are"} open to enter. Ask for a suggested season, or pick events from the calendar.`
              : "Nothing is open to enter on the calendar right now. AITA publishes about ten weeks ahead, so this fills in."}
          </p>
        </div>
      )}
    </section>
  );
}

function SeasonTile({
  entries,
  annualCap,
  bracket,
}: {
  entries: SeasonPlanEntry[];
  annualCap: number | null;
  bracket: string;
}) {
  const count = (status: SeasonPlanEntry["status"]) =>
    entries.filter((entry) => entry.status === status).length;
  const thisYear = new Date().getUTCFullYear();
  const countedThisYear = entries.filter(
    (entry) => new Date(entry.startDate).getUTCFullYear() === thisYear
  ).length;

  return (
    <section
      aria-labelledby="season-tile"
      className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-3"
    >
      <h2 id="season-tile" className={`${LABEL} text-slate-500`}>
        The plan
      </h2>
      <p className="font-title mt-2 text-3xl font-extrabold leading-none text-slate-900">
        {entries.length}
        <span className="ml-2 text-sm font-semibold text-slate-500">
          event{entries.length === 1 ? "" : "s"}
        </span>
      </p>
      <dl className="mt-3 space-y-1 text-sm text-slate-700">
        <div className="flex justify-between gap-3">
          <dt>Still to enter</dt>
          <dd className="font-semibold text-slate-900">{count("shortlisted")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Entered</dt>
          <dd className="font-semibold text-slate-900">{count("entered")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Played</dt>
          <dd className="font-semibold text-slate-900">{count("played")}</dd>
        </div>
      </dl>
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-600">
        {annualCap
          ? `${countedThisYear} of ${annualCap} yearly entries in ${bracket} are on this plan. Playing up uses the same allowance.`
          : `${countedThisYear} event${countedThisYear === 1 ? "" : "s"} on this plan for ${thisYear}.`}
      </p>
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
      className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-4"
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
  openCount,
  annualCap,
  bracket,
  costs,
  costsLoading,
  costsFailed,
  saveHomeCity,
  onOpenEvent,
}: {
  entries: SeasonPlanEntry[];
  calendar: Map<string, PlannerEdition>;
  openCount: number;
  annualCap: number | null;
  bracket: string;
  costs: CostResponse | null;
  costsLoading: boolean;
  costsFailed: boolean;
  saveHomeCity: { saving: boolean; save: (city: string) => void };
  onOpenEvent: (slug: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const items = nextUp({ entries, calendar, today });

  return (
    <div aria-label="Season at a glance" className="grid gap-4 lg:grid-cols-12">
      <NextUpTile items={items} openCount={openCount} onOpen={onOpenEvent} />
      <SeasonTile entries={entries} annualCap={annualCap} bracket={bracket} />
      <BudgetTile
        costs={costs}
        costsLoading={costsLoading}
        costsFailed={costsFailed}
        saveHomeCity={saveHomeCity}
      />
    </div>
  );
}
