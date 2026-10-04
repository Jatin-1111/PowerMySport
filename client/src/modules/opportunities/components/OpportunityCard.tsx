import { ArrowRight, CircleHelp, CircleCheck, CircleX } from "lucide-react";
import Link from "next/link";

import { CYCLE_LABELS, SELECTION_LABELS, TRACKS } from "../config/tracks";
import type { Opportunity } from "../services/opportunities";
import {
  deadlineLine,
  eligibilityChips,
  formatAmount,
  formatDay,
  sportsLabel,
  whereLabel,
} from "../utils/format";
import { VERDICT_LABELS, type Verdict } from "../utils/match";

const CYCLE_TONE: Record<Opportunity["cycleState"], string> = {
  open: "bg-emerald-50 text-emerald-800",
  upcoming: "bg-sky-50 text-sky-800",
  closed: "bg-slate-100 text-slate-700",
  rolling: "bg-slate-100 text-slate-700",
};

const VERDICT_STYLE: Record<Verdict, { tone: string; Icon: typeof CircleCheck }> = {
  fits: { tone: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CircleCheck },
  check: { tone: "border-amber-200 bg-amber-50 text-amber-900", Icon: CircleHelp },
  no: { tone: "border-slate-200 bg-slate-100 text-slate-700", Icon: CircleX },
};

/**
 * One entry in a list. It leads with what a parent scans for: whether it fits
 * their child (once they have said who the child is), what it gives, who it is
 * for, and when the window closes. How it is obtained and where the window
 * stands come first among the badges because they decide whether there is
 * anything to do this year.
 *
 * `today` is the server's India date, passed in rather than read here, so the
 * "days left" the server rendered and the one the browser hydrates always agree.
 */
export function OpportunityCard({
  opportunity,
  today,
  categoryLabel,
  verdict,
}: {
  opportunity: Opportunity;
  today: string;
  /** Shown above the title when the list is not already grouped by category. */
  categoryLabel?: string;
  verdict?: Verdict | null;
}) {
  const track = TRACKS[opportunity.track];
  const selection = opportunity.selection ? SELECTION_LABELS[opportunity.selection] : null;
  const amount = formatAmount(opportunity.benefit?.amount);
  const where = whereLabel(opportunity.geography);
  const chips = eligibilityChips(opportunity.eligibility).slice(0, 3);
  const deadline = deadlineLine(opportunity, today);
  const verdictStyle = verdict ? VERDICT_STYLE[verdict] : null;

  return (
    <Link
      href={`${track.path}/${opportunity.slug}`}
      className="hover:border-power-orange/40 focus-visible:ring-power-orange-solid group flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow] hover:shadow-md focus-visible:outline-none focus-visible:ring-2"
    >
      {verdict && verdictStyle && (
        <p
          className={`mb-3 inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold ${verdictStyle.tone}`}
        >
          <verdictStyle.Icon aria-hidden className="h-3.5 w-3.5" />
          {VERDICT_LABELS[verdict]}
        </p>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {selection && (
          <span className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-800">
            {selection.label}
          </span>
        )}
        {opportunity.cycleState !== "rolling" && (
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold ${CYCLE_TONE[opportunity.cycleState]}`}
          >
            {CYCLE_LABELS[opportunity.cycleState]}
          </span>
        )}
      </div>

      {categoryLabel && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {categoryLabel}
        </p>
      )}
      <h3 className="font-title text-base font-bold leading-snug text-slate-900 group-hover:text-orange-700">
        {opportunity.title}
      </h3>
      {opportunity.owner?.name && (
        <p className="mt-1 text-sm text-slate-600">{opportunity.owner.name}</p>
      )}

      {amount ? (
        <div className="mt-3">
          <p className="font-title text-lg font-bold text-slate-900">{amount}</p>
          {opportunity.benefit?.summary && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-700">
              {opportunity.benefit.summary}
            </p>
          )}
        </div>
      ) : (
        opportunity.benefit?.summary && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-700">
            {opportunity.benefit.summary}
          </p>
        )
      )}

      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Who it is for">
          {chips.map((chip) => (
            <li
              key={chip}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              {chip}
            </li>
          ))}
        </ul>
      )}

      {deadline && (
        <p
          className={`mt-3 text-sm font-semibold ${deadline.urgent ? "text-amber-800" : "text-slate-700"}`}
        >
          {deadline.text}
        </p>
      )}

      <div className="mt-auto flex items-end justify-between gap-3 pt-4 text-xs text-slate-600">
        <span className="min-w-0">
          <span className="block truncate">
            {[sportsLabel(opportunity), where].filter(Boolean).join(" · ")}
          </span>
          {opportunity.lastVerifiedOn && (
            <span className="mt-0.5 block text-slate-500">
              Checked {formatDay(opportunity.lastVerifiedOn)}
            </span>
          )}
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-slate-500" />
      </div>
    </Link>
  );
}
