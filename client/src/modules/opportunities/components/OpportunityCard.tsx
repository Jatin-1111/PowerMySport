import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CYCLE_LABELS, SELECTION_LABELS, TRACKS } from "../config/tracks";
import type { Opportunity } from "../services/opportunities";
import { formatAmount, sportsLabel, whereLabel } from "../utils/format";

const CYCLE_TONE: Record<Opportunity["cycleState"], string> = {
  open: "bg-emerald-50 text-emerald-800",
  upcoming: "bg-sky-50 text-sky-800",
  closed: "bg-slate-100 text-slate-600",
  rolling: "bg-slate-100 text-slate-600",
};

/**
 * One entry in a list. Leads with how it is obtained and whether its window is
 * open, because those two decide whether there is anything to do this year.
 */
export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const track = TRACKS[opportunity.track];
  const selection = opportunity.selection ? SELECTION_LABELS[opportunity.selection] : null;
  const amount = formatAmount(opportunity.benefit?.amount);
  const where = whereLabel(opportunity.geography);

  return (
    <Link
      href={`${track.path}/${opportunity.slug}`}
      className="hover:border-power-orange/40 group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {selection && (
          <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-800">
            {selection.label}
          </span>
        )}
        {opportunity.cycleState !== "rolling" && (
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${CYCLE_TONE[opportunity.cycleState]}`}
          >
            {CYCLE_LABELS[opportunity.cycleState]}
          </span>
        )}
      </div>

      <h3 className="font-title text-[16px] font-bold leading-snug text-slate-900 group-hover:text-orange-700">
        {opportunity.title}
      </h3>
      {opportunity.owner?.name && (
        <p className="mt-1 text-[13px] text-slate-500">{opportunity.owner.name}</p>
      )}

      {opportunity.benefit?.summary && (
        <p className="mt-3 line-clamp-3 text-[14px] leading-relaxed text-slate-700">
          {amount ?? opportunity.benefit.summary}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[12.5px] text-slate-500">
        <span className="truncate">
          {[sportsLabel(opportunity), where].filter(Boolean).join(" · ")}
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
    </Link>
  );
}
