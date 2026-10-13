import type { ProposedChange } from "@/modules/admin/services/opportunities";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

/** Plain names for the change paths, in the order the public page reads. */
export const PATH_LABELS: Record<string, string> = {
  title: "Title",
  category: "Section",
  summary: "Summary",
  "owner.name": "Run by",
  "owner.type": "Kind of organisation",
  allSports: "Covers all sports",
  sports: "Sports",
  "geography.scope": "Where",
  "geography.state": "State",
  "eligibility.ageMin": "Youngest age",
  "eligibility.ageMax": "Oldest age",
  "eligibility.ageNote": "Age rule",
  "eligibility.gender": "Gender",
  "eligibility.level": "Sporting level required",
  "eligibility.academic": "Academic requirement",
  "eligibility.income": "Income limit",
  selection: "How you get it",
  "benefit.summary": "What it gives",
  "benefit.amount": "Amount",
  "cycle.label": "Cycle",
  "cycle.opensOn": "Window opens",
  "cycle.closesOn": "Window closes",
  "cycle.keyDates": "Key dates",
  steps: "Steps",
  keyFacts: "Good to know",
  applyUrl: "Application link",
};

const PATH_ORDER = Object.keys(PATH_LABELS);
export const byPageOrder = (a: ProposedChange, b: ProposedChange) =>
  (PATH_ORDER.indexOf(a.path) + 1 || 999) - (PATH_ORDER.indexOf(b.path) + 1 || 999);

/** Any stored value, readably: lists as lists, objects as "key: value" lines. */
export function ChangeValue({ value, muted }: { value: unknown; muted?: boolean }) {
  const tone = muted ? "text-slate-500" : "text-slate-900";
  if (value === null || value === undefined || value === "") {
    return <span className="text-xs italic text-slate-400">(empty)</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className={`list-disc space-y-1 pl-4 text-sm ${tone}`}>
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === "object" && item !== null
              ? Object.values(item as Record<string, unknown>).join(" · ")
              : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <span className={`text-sm ${tone}`}>
        {Object.entries(value as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(" · ")}
      </span>
    );
  }
  if (typeof value === "boolean")
    return <span className={`text-sm ${tone}`}>{value ? "Yes" : "No"}</span>;
  return <span className={`whitespace-pre-line text-sm ${tone}`}>{String(value)}</span>;
}

/**
 * Evidence against a row, found by comparing text rather than by asking a model:
 * a quote that is not on the page, or a figure that is not in its own quote. A
 * row with either starts unticked, so keeping it is a decision.
 */
export const hasEvidenceAgainst = (change: ProposedChange): boolean =>
  change.quoteCheck === "missing" || change.figureCheck === "mismatch";

/** What the mechanical checks found about a row's quote. Says nothing when all is well. */
function QuoteFlags({ change }: { change: ProposedChange }) {
  return (
    <div className="space-y-1">
      {change.quoteCheck === "missing" && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-red-700">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This quote is not on the page. The reading may have made it up, so check the source before
          keeping this.
        </p>
      )}
      {change.quoteCheck === "partial" && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This quote only partly matches the page. Compare it with the source.
        </p>
      )}
      {change.figureCheck === "mismatch" && (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-red-700">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The number or date here is not in the quote given for it. Check it in the source.
        </p>
      )}
      {change.sharedQuote !== undefined && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The same quote was given for {change.sharedQuote} fields. One sentence cannot support them
          all, so look for what backs this one.
        </p>
      )}
      {change.quoteCheck === "found" &&
        change.figureCheck !== "mismatch" &&
        change.sharedQuote === undefined && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Quote found on the page.
          </p>
        )}
    </div>
  );
}

export function ChangeRow({
  change,
  kept,
  onToggle,
  isNew,
}: {
  change: ProposedChange;
  kept: boolean;
  onToggle: () => void;
  /** A new entry has no "current" column to show. */
  isNew: boolean;
}) {
  return (
    <li
      className={`rounded-xl border p-4 transition ${
        kept ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white opacity-70"
      }`}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={kept} onChange={onToggle} className="mt-1" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-bold text-slate-900">
            {PATH_LABELS[change.path] ?? change.path}
          </p>
          <div className={`grid gap-3 ${isNew ? "" : "sm:grid-cols-2"}`}>
            {!isNew && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Now</p>
                <ChangeValue value={change.current} muted />
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                {isNew ? "Read from the source" : "Source says"}
              </p>
              <ChangeValue value={change.proposed} />
            </div>
          </div>
          {change.citation ? (
            <blockquote className="border-l-2 border-slate-300 pl-3 text-xs italic text-slate-600">
              “{change.citation}”
            </blockquote>
          ) : (
            <p className="text-xs text-amber-700">
              No quote was given for this. Check it in the source before keeping it.
            </p>
          )}
          <QuoteFlags change={change} />
        </div>
      </label>
    </li>
  );
}
