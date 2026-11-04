import { ArrowRight, CircleCheck, CircleHelp, CircleX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

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

const VERDICT_STYLE: Record<Verdict, { tone: string; Icon: typeof CircleCheck }> = {
  fits: { tone: "text-green-700", Icon: CircleCheck },
  check: { tone: "text-ink", Icon: CircleHelp },
  no: { tone: "text-ink-muted", Icon: CircleX },
};

/** The column grid shared by the heading row and every entry. */
export const ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)] md:gap-x-6";

/** A caption that only shows on small screens, where the columns stack. */
function Cell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-ink-muted mb-1 text-sm md:hidden">{caption}</p>
      {children}
    </div>
  );
}

export function OpportunityTableHead() {
  return (
    <div
      aria-hidden="true"
      className={`${ROW_GRID} text-ink-muted border-hairline hidden border-b pb-3 text-sm`}
    >
      <span>Entry</span>
      <span>What it gives</span>
      <span>Who it is for</span>
      <span>Window</span>
    </div>
  );
}

/**
 * One entry in the list, laid out as a row of a comparison table: the name and
 * how well it fits, what it gives, who it is for, and where its window stands.
 * Rows are separated by hairlines. On a phone the same four parts stack, each
 * under a small caption.
 *
 * `today` is the server's India date, passed in rather than read here, so the
 * "days left" the server rendered and the one the browser hydrates always agree.
 */
export function OpportunityRow({
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
  const cycle = opportunity.cycleState !== "rolling" ? CYCLE_LABELS[opportunity.cycleState] : null;

  return (
    <Link
      href={`${track.path}/${opportunity.slug}`}
      className={`${ROW_GRID} hover:bg-paper-deep/60 focus-visible:ring-ink group block space-y-4 px-1 py-6 transition-colors focus-visible:outline-none focus-visible:ring-2 md:space-y-0 md:px-2`}
    >
      <Cell caption="Entry">
        {categoryLabel && <p className="text-ink-muted mb-1 text-sm">{categoryLabel}</p>}
        <h3 className="text-ink text-lg font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
          {opportunity.title}
        </h3>
        {opportunity.owner?.name && (
          <p className="text-ink-muted mt-1 text-sm">{opportunity.owner.name}</p>
        )}
        {verdict && verdictStyle && (
          <p
            className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium ${verdictStyle.tone}`}
          >
            <verdictStyle.Icon aria-hidden className="h-4 w-4" />
            {VERDICT_LABELS[verdict]}
          </p>
        )}
        {selection && <p className="text-ink-body mt-2 text-sm">{selection.label}</p>}
      </Cell>

      <Cell caption="What it gives">
        {amount && (
          <p className="text-ink text-2xl font-light tabular-nums tracking-tight">{amount}</p>
        )}
        {opportunity.benefit?.summary && (
          <p
            className={`text-ink-body line-clamp-3 text-pretty text-sm leading-relaxed ${amount ? "mt-1" : ""}`}
          >
            {opportunity.benefit.summary}
          </p>
        )}
      </Cell>

      <Cell caption="Who it is for">
        {chips.length > 0 && (
          <ul className="text-ink-body space-y-0.5 text-sm" aria-label="Who it is for">
            {chips.map((chip) => (
              <li key={chip}>{chip}</li>
            ))}
          </ul>
        )}
        <p className="text-ink-muted mt-2 text-sm">
          {[sportsLabel(opportunity), where].filter(Boolean).join(" · ")}
        </p>
      </Cell>

      <Cell caption="Window">
        {cycle && <p className="text-ink-body text-sm">{cycle}</p>}
        {deadline && (
          <p
            className={`mt-0.5 text-sm tabular-nums ${deadline.urgent ? "text-ink font-semibold" : "text-ink-body"}`}
          >
            {deadline.text}
          </p>
        )}
        <p className="text-ink-muted mt-2 flex items-center justify-between gap-2 text-sm">
          <span>
            {opportunity.lastVerifiedOn ? `Checked ${formatDay(opportunity.lastVerifiedOn)}` : ""}
          </span>
          <ArrowRight aria-hidden className="text-ink h-4 w-4 shrink-0" />
        </p>
      </Cell>
    </Link>
  );
}
