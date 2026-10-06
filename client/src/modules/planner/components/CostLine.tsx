"use client";

import type { EntryCosts } from "@/modules/planner/services/seasonPlan";
import type { EventCost } from "@/modules/planner/services/planner";
import { formatInr, formatRange, parseRupees } from "@/modules/planner/utils/money";
import { Button } from "@/modules/shared/ui/Button";
import { ChevronDown, Pencil } from "lucide-react";
import { useState } from "react";

/**
 * What an event is expected to cost, in the words that keep it honest.
 *
 * ── What is on screen, and why ──────────────────────────────────────────────
 * A range, never a single price, and always labelled for what it is: an estimate,
 * a rough estimate when the AI model was not used, or the parent's own figure.
 * The total is for travel and stay only, and says so, because the calendar does
 * not publish entry fees and we do not guess them. A parent who knows the fee can
 * type it, and the line then says it is included.
 *
 * Open the details to see exactly what each part assumes.
 */

function sourceLabel(cost: EventCost): string {
  const parts = [cost.travel, cost.stay].filter((part): part is NonNullable<typeof part> =>
    Boolean(part)
  );
  const yours = parts.filter((part) => part.basis === "yours").length;
  if (parts.length > 0 && yours === parts.length) return "your figures";
  if (yours > 0) return "estimate and your figures";
  return cost.source === "rough" ? "rough estimate" : "estimate";
}

/** Who the entry fee in the total comes from, in the words a parent would use. */
function feeLabel(cost: EventCost): string {
  if (cost.entryFee === null) return "entry fee not included";
  const amount = formatInr(cost.entryFee);
  if (cost.entryFeeBasis === "fact-sheet") return `includes the ${amount} AITA entry fee`;
  if (cost.entryFeeBasis === "rules") return `includes the ${amount} entry fee from AITA's rules`;
  return `includes your entry fee of ${amount}`;
}

function FigureForm({
  cost,
  initial,
  saving,
  onSave,
  onCancel,
}: {
  cost: EventCost | undefined;
  initial: EntryCosts | undefined;
  saving: boolean;
  onSave: (costs: { [K in keyof EntryCosts]: number | null }) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState({
    travel: initial?.travel === undefined ? "" : String(initial.travel),
    stay: initial?.stay === undefined ? "" : String(initial.stay),
    entryFee: initial?.entryFee === undefined ? "" : String(initial.entryFee),
  });

  const parsed = {
    travel: parseRupees(text.travel),
    stay: parseRupees(text.stay),
    entryFee: parseRupees(text.entryFee),
  };
  const invalid = Object.values(parsed).some((value) => value !== null && Number.isNaN(value));

  const field = (key: keyof EntryCosts, label: string, placeholder: string) => (
    <label className="text-xs font-semibold text-slate-700">
      {label}
      <div className="mt-1 flex items-center gap-1">
        <span aria-hidden className="text-sm text-slate-500">
          ₹
        </span>
        <input
          type="text"
          inputMode="numeric"
          aria-label={label}
          value={text[key]}
          placeholder={placeholder}
          onChange={(event) => setText((current) => ({ ...current, [key]: event.target.value }))}
          className="focus-visible:ring-power-orange-solid min-h-9 w-28 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2"
        />
      </div>
    </label>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid) return;
        // null clears a part, so emptying a box removes the parent's own figure and
        // the estimate comes back.
        onSave({
          travel: parsed.travel as number | null,
          stay: parsed.stay as number | null,
          entryFee: parsed.entryFee as number | null,
        });
      }}
      className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3"
    >
      <p className="text-xs leading-relaxed text-slate-600">
        Your own figures replace ours. Leave a box empty to use the estimate again.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        {field("travel", "Travel", cost?.travel ? String(cost.travel.low) : "")}
        {field("stay", "Stay and meals", cost?.stay ? String(cost.stay.low) : "")}
        {field("entryFee", "Entry fee", "from the fact sheet")}
      </div>
      {invalid && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          Enter whole rupees, for example 8000.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={invalid || saving}>
          {saving ? "Saving..." : "Save figures"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CostLine({
  cost,
  loading,
  yours,
  saving = false,
  onSave,
}: {
  cost: EventCost | undefined;
  loading: boolean;
  /** The parent's own figures for this event, for editing. */
  yours?: EntryCosts | undefined;
  saving?: boolean;
  /** Present only where figures can be edited, which is the plan. */
  onSave?: (costs: { [K in keyof EntryCosts]: number | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!cost) {
    return loading ? (
      <p className="mt-2 text-xs text-slate-500">Estimating travel and stay...</p>
    ) : null;
  }

  return (
    <div className="mt-2 text-xs leading-relaxed">
      {cost.total ? (
        <p className="text-slate-800">
          <span className="font-semibold">
            Travel and stay {formatRange(cost.total.low, cost.total.high)}
          </span>
          <span className="text-slate-500">
            {" "}
            ({sourceLabel(cost)}, {feeLabel(cost)})
          </span>
        </p>
      ) : (
        cost.note && <p className="text-slate-500">{cost.note}</p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {(cost.travel || cost.stay) && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:underline"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
            How this is worked out
          </button>
        )}
        {onSave && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Add or edit my figures
          </button>
        )}
      </div>

      {open && (
        <dl className="mt-2 space-y-1 rounded-md bg-slate-50 p-3 text-slate-700">
          {cost.travel && (
            <div className="flex justify-between gap-4">
              <dt>Travel{cost.travel.basis === "yours" ? " (yours)" : ""}</dt>
              <dd>{formatRange(cost.travel.low, cost.travel.high)}</dd>
            </div>
          )}
          {cost.stay && (
            <div className="flex justify-between gap-4">
              <dt>Stay and meals{cost.stay.basis === "yours" ? " (yours)" : ""}</dt>
              <dd>{formatRange(cost.stay.low, cost.stay.high)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt>Entry fee</dt>
            <dd>
              {cost.entryFee === null
                ? "Not estimated, check the fact sheet"
                : `${formatInr(cost.entryFee)} (${
                    cost.entryFeeBasis === "yours"
                      ? "yours"
                      : cost.entryFeeBasis === "fact-sheet"
                        ? "singles, from AITA"
                        : "singles, from AITA's rules"
                  })`}
            </dd>
          </div>
          {cost.assumptions && <p className="pt-1 text-slate-500">{cost.assumptions}</p>}
          <p className="text-slate-500">
            These are estimates, not quotes. Fares and rooms change with the date and how early you
            book.
          </p>
        </dl>
      )}

      {onSave && editing && (
        <FigureForm
          cost={cost}
          initial={yours}
          saving={saving}
          onSave={(costs) => {
            onSave(costs);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
