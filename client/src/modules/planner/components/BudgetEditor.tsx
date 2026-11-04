"use client";

import { formatInr, parseRupees } from "@/modules/planner/utils/money";
import { Button } from "@/modules/shared/ui/Button";
import { useId, useState } from "react";

/**
 * The season budget, set where the cost is shown.
 *
 * A parent who sees "₹17,600 to ₹60,100" asks "is that too much?" right there, not in a
 * setup panel further down. With no budget it is a single field that says what it is
 * for; with one it is a line that can be changed or removed. The same whole-rupee rule
 * as the season setup applies, so the two can never disagree about what a budget is.
 */

const MAX_BUDGET = 10_000_000;

const FIELD =
  "min-h-11 w-full rounded-lg border border-hairline bg-white px-3 text-sm text-ink focus-visible:border-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink";

export function BudgetEditor({
  budget,
  saving,
  onSave,
}: {
  budget: number | null;
  saving: boolean;
  onSave: (budget: number | null) => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const parsed = parseRupees(text);
  const problem =
    parsed !== null && (Number.isNaN(parsed) || parsed > MAX_BUDGET)
      ? "Enter the budget in whole rupees, for example 60000."
      : null;
  const value = parsed === null || problem ? null : parsed;

  if (budget !== null && !editing) {
    return (
      <p className="text-ink-body text-sm">
        Budget {formatInr(budget)}
        <button
          type="button"
          onClick={() => {
            setText(String(budget));
            setEditing(true);
          }}
          className="text-power-orange-solid ml-2 font-semibold hover:underline"
        >
          Change
        </button>
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value === null || problem) return;
        onSave(value);
        setEditing(false);
        setText("");
      }}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <label htmlFor={id} className="text-ink text-sm font-semibold">
          {budget === null ? "Set a budget (optional)" : "Change the budget"}
        </label>
        <span className="text-ink-muted text-sm">to see whether the plan fits</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span aria-hidden className="text-ink-body">
          ₹
        </span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="60000"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-problem` : undefined}
          className={FIELD}
        />
        <Button type="submit" variant="outline" size="sm" disabled={saving || value === null}>
          Save
        </Button>
      </div>
      {problem && (
        <p id={`${id}-problem`} role="alert" className="mt-1 text-sm text-red-700">
          {problem}
        </p>
      )}
      {budget !== null && (
        <div className="mt-2 flex gap-4 text-sm">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setText("");
            }}
            className="text-ink-body font-medium hover:underline"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              onSave(null);
              setEditing(false);
              setText("");
            }}
            className="text-ink-body font-medium hover:underline"
          >
            Remove the budget
          </button>
        </div>
      )}
    </form>
  );
}
