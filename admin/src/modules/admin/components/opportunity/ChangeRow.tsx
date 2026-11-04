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
  "eligibility.summary": "Who can apply (one line)",
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
  cost: "Cost",
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

/**
 * A cost as a parent will read it: "Free. Girls play free", "₹125. City round",
 * "Varies. By city". Null for anything that is not a cost, so the caller falls
 * back to the generic rendering.
 */
export function describeCost(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { kind, amount, currency, note } = value as Record<string, unknown>;
  if (kind !== "free" && kind !== "fee" && kind !== "varies") return null;
  let head: string;
  if (kind === "free") head = "Free";
  else if (
    kind === "fee" &&
    typeof amount === "number" &&
    (currency === "INR" || currency === "USD")
  ) {
    head = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } else head = kind === "fee" ? "A fee" : "Varies";
  const text = typeof note === "string" ? note.trim() : "";
  return text ? `${head}. ${text}` : head;
}

/** Any stored value, readably: lists as lists, objects as "key: value" lines. */
export function ChangeValue({
  value,
  muted,
  path,
}: {
  value: unknown;
  muted?: boolean;
  /** The field the value belongs to, for the few that read better than "key: value". */
  path?: string;
}) {
  const tone = muted ? "text-slate-500" : "text-slate-900";
  const cost = path === "cost" ? describeCost(value) : null;
  if (cost) return <span className={`text-sm ${tone}`}>{cost}</span>;
  if (value === null || value === undefined || value === "") {
    return <span className="text-xs italic text-slate-500">(empty)</span>;
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
  change.quoteCheck === "missing" ||
  change.figureCheck === "mismatch" ||
  // Two official documents that disagree: the one figure most worth checking by hand.
  (change.conflicts?.length ?? 0) > 0;

/** What the mechanical checks found about a row's quote. Says nothing when all is well. */
function QuoteFlags({ change }: { change: ProposedChange }) {
  return (
    <div className="space-y-1">
      {change.conflicts && change.conflicts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
          <p className="flex items-start gap-1.5 font-semibold">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The documents disagree about this. Check which one applies before keeping it.
          </p>
          <ul className="mt-1.5 space-y-1 pl-5">
            {change.conflicts.map((other) => (
              <li key={other.url}>
                <a
                  href={other.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline"
                >
                  {other.label}
                </a>{" "}
                says: <ChangeValue value={other.value} path={change.path} />
                {other.quote && <span className="italic"> &ldquo;{other.quote}&rdquo;</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
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
      {change.quoteCheck === "scattered" && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The words of this quote are in the document, but not together. That is normal for a table,
          so compare it with the document.
        </p>
      )}
      {change.quoteCheck === "unmatched" && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This quote could not be matched in the document&apos;s text. A scan or a table can cause
          that, so look at the document before keeping this.
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
            Quote found in the source.
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
          <p className="text-sm font-semibold text-slate-900">
            {PATH_LABELS[change.path] ?? change.path}
            {change.from && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                from{" "}
                <a
                  href={change.from.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-700 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {change.from.label}
                </a>
              </span>
            )}
          </p>
          <div className={`grid gap-3 ${isNew ? "" : "sm:grid-cols-2"}`}>
            {!isNew && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Now</p>
                <ChangeValue value={change.current} muted path={change.path} />
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold text-emerald-700">
                {isNew ? "Read from the source" : "Source says"}
              </p>
              <ChangeValue value={change.proposed} path={change.path} />
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
