"use client";

import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import {
  MAX_BLOCKED_RANGES,
  type BlockedRange,
  type PlanPreferences,
  type SeasonGoal,
} from "@/modules/planner/services/seasonPlan";
import { formatInr, parseRupees } from "@/modules/planner/utils/money";
import { Button } from "@/modules/shared/ui/Button";
import { ChevronDown, Plus, X } from "lucide-react";
import { useState } from "react";

/**
 * What the parent wants the season to be for, and the dates their child cannot
 * play. Everything the suggestions are built around that the calendar cannot
 * tell us.
 *
 * ── Why a short list and not a free-text box ────────────────────────────────
 * The recommender serves exactly these three goals. A text box would promise
 * something it cannot do ("find me cheap events near my cousin") and would send
 * the parent's own words to a model for no benefit.
 *
 * ── Why the form is keyed by what is saved ──────────────────────────────────
 * The draft lives in a child that starts from the saved preferences. When a save
 * lands, the saved value changes, the key changes, and the form starts again from
 * it, with no effect copying props into state.
 */

const GOALS: Array<{ value: SeasonGoal; label: string; blurb: string }> = [
  {
    value: "points",
    label: "Climb the ranking",
    blurb: "Favours the higher rungs of the circuit.",
  },
  {
    value: "experience",
    label: "Match experience",
    blurb: "Favours entry-level events, where the draw is not cut by ranking.",
  },
  {
    value: "home",
    label: "Stay close to home",
    blurb: "Favours events in their own state.",
  },
];

const GOAL_LABEL: Record<SeasonGoal, string> = {
  points: "Climb the ranking",
  experience: "Match experience",
  home: "Stay close to home",
};

const DEFAULT_PREFERENCES: PlanPreferences = { goal: "points", blockedRanges: [], budget: null };

const INPUT =
  "min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange-solid";

/** A row is usable when both dates are set and the range does not run backwards. */
const rowProblem = (row: BlockedRange): string | null => {
  if (!row.from && !row.to) return null; // an empty row is simply dropped
  if (!row.from || !row.to) return "Choose both a start and an end date.";
  if (row.to < row.from) return "The end date is before the start date.";
  return null;
};

function PreferencesForm({
  saved,
  homeState,
  saving,
  onSave,
}: {
  saved: PlanPreferences;
  homeState: string | null;
  saving: boolean;
  onSave: (preferences: PlanPreferences) => void;
}) {
  const [goal, setGoal] = useState<SeasonGoal>(saved.goal);
  const [rows, setRows] = useState<BlockedRange[]>(saved.blockedRanges);
  const [budgetText, setBudgetText] = useState<string>(
    saved.budget === null ? "" : String(saved.budget)
  );

  // Blank means no ceiling. Anything else must be a plain whole-rupee amount.
  const parsedBudget = parseRupees(budgetText);
  const budgetProblem =
    parsedBudget !== null && (Number.isNaN(parsedBudget) || parsedBudget > 10_000_000)
      ? "Enter the budget in whole rupees, for example 60000."
      : null;
  const budget = parsedBudget === null || budgetProblem ? null : parsedBudget;

  const problems = rows.map(rowProblem);
  const usable = rows.filter((row) => row.from && row.to);
  const changed =
    goal !== saved.goal ||
    budget !== saved.budget ||
    JSON.stringify(usable) !== JSON.stringify(saved.blockedRanges);
  const canSave = changed && !budgetProblem && problems.every((problem) => problem === null);

  const update = (index: number, patch: Partial<BlockedRange>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) {
          onSave({
            goal,
            budget,
            blockedRanges: usable.map(({ from, to, label }) => ({
              from,
              to,
              ...(label?.trim() ? { label: label.trim() } : {}),
            })),
          });
        }
      }}
      className="space-y-6"
    >
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">What is this season for?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {GOALS.map((option) => {
            const unavailable = option.value === "home" && !homeState;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${
                  goal === option.value
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                } ${unavailable ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="season-goal"
                  value={option.value}
                  checked={goal === option.value}
                  disabled={unavailable}
                  onChange={() => setGoal(option.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-900">{option.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                    {unavailable
                      ? "Their home state is not on the ranking list, so this is not available yet."
                      : option.value === "home" && homeState
                        ? `Favours events in ${homeState}.`
                        : option.blurb}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">Dates they cannot play</legend>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Exams, holidays or anything else. Events that run into these dates are left out of the
          suggestions.
        </p>

        {rows.length > 0 && (
          <ul className="mt-3 space-y-3">
            {rows.map((row, index) => (
              <li key={index}>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    From
                    <input
                      type="date"
                      value={row.from}
                      onChange={(event) => update(index, { from: event.target.value })}
                      className={`${INPUT} mt-1 block`}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    To
                    <input
                      type="date"
                      value={row.to}
                      min={row.from || undefined}
                      onChange={(event) => update(index, { to: event.target.value })}
                      className={`${INPUT} mt-1 block`}
                    />
                  </label>
                  <label className="min-w-40 flex-1 text-xs font-semibold text-slate-700">
                    Note (optional)
                    <input
                      type="text"
                      value={row.label ?? ""}
                      maxLength={40}
                      placeholder="Board exams"
                      onChange={(event) => update(index, { label: event.target.value })}
                      className={`${INPUT} mt-1 block w-full`}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove these dates"
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    className="text-slate-500"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                {problems[index] && (
                  <p role="alert" className="mt-1 text-xs text-red-700">
                    {problems[index]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {rows.length < MAX_BLOCKED_RANGES && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setRows((current) => [...current, { from: "", to: "" }])}
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Add dates
          </Button>
        )}
      </fieldset>

      <div>
        <label htmlFor="season-budget" className="text-sm font-semibold text-slate-900">
          Season budget (optional)
        </label>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          What you want the plan to stay within, for travel and stay. The planner shows the plan
          against it.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-slate-600" aria-hidden>
            ₹
          </span>
          <input
            id="season-budget"
            type="text"
            inputMode="numeric"
            value={budgetText}
            placeholder="60000"
            onChange={(event) => setBudgetText(event.target.value)}
            className={`${INPUT} w-40`}
            aria-describedby={budgetProblem ? "season-budget-problem" : undefined}
          />
        </div>
        {budgetProblem && (
          <p id="season-budget-problem" role="alert" className="mt-1 text-xs text-red-700">
            {budgetProblem}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={!canSave || saving}>
          {saving ? "Saving..." : "Save preferences"}
        </Button>
        {!changed && <span className="text-xs text-slate-500">Nothing changed yet.</span>}
      </div>
    </form>
  );
}

export function PreferencesPanel({
  dependentId,
  homeState,
}: {
  dependentId: string;
  homeState: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { preferences, savePreferences } = useSeasonPlan(dependentId);
  const saved = preferences ?? DEFAULT_PREFERENCES;

  const blocked = saved.blockedRanges.length;
  const summary = `${GOAL_LABEL[saved.goal]}${
    blocked > 0 ? `, ${blocked} blocked date range${blocked === 1 ? "" : "s"}` : ""
  }${saved.budget !== null ? `, budget ${formatInr(saved.budget)}` : ""}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm">
          <span className="font-semibold text-slate-900">Planning preferences</span>
          <span className="ml-2 text-slate-600">{summary}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-slate-200 bg-white p-4">
          {/* Keyed by what is saved: after a save the form restarts from it. */}
          <PreferencesForm
            key={JSON.stringify(saved)}
            saved={saved}
            homeState={homeState}
            saving={savePreferences.isPending}
            onSave={(next) => savePreferences.mutate(next)}
          />
        </div>
      )}
    </div>
  );
}
