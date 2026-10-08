"use client";

import { TimelineEventCard } from "@/modules/planner/components/TimelineEventCard";
import { formatLongDate } from "@/modules/planner/utils/eventFormat";
import { deadlineState, groupByMonth, type DeadlineState } from "@/modules/planner/utils/timeline";
import type { PlannerEntry, ReachVerdict, Shortlist } from "@powermysport/shared-types";
import { ChevronDown, Clock } from "lucide-react";
import { useState } from "react";

/**
 * What the child can enter, laid out as the calendar runs.
 *
 * ── Ordering ────────────────────────────────────────────────────────────────
 * Chronological, by month, with their own age group first and playing up behind
 * a disclosure. The one thing pulled forward is an entry deadline that is about
 * to pass, because that is the only fact on this page with a clock on it, and
 * only when the federation published one.
 *
 * Playing up is offered rather than assumed: older groups simply hold more
 * events, so merging them in buries a child's own fixtures under other
 * children's, and playing up spends the same yearly entry allowance.
 */

interface Props {
  shortlist: Shortlist;
  plannedSlugs: Set<string>;
  isAdding: boolean;
  onAdd: (slug: string) => void;
  /** What past draws showed for each open event, by slug. */
  reach?: Record<string, ReachVerdict>;
}

type SoonState = Extract<DeadlineState, { kind: "soon" }>;

function Disclosure({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:underline"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        {label} ({count})
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function Timeline({ shortlist, plannedSlugs, isAdding, onAdd, reach = {} }: Props) {
  const renderCard = (entry: PlannerEntry, mode: "open" | "closed") => (
    <TimelineEventCard
      key={entry.edition.slug ?? entry.edition.name}
      entry={entry}
      mode={mode}
      isPlanned={entry.edition.slug ? plannedSlugs.has(entry.edition.slug) : false}
      isAdding={isAdding}
      onAdd={() => entry.edition.slug && onAdd(entry.edition.slug)}
      verdict={entry.edition.slug ? reach[entry.edition.slug] : undefined}
    />
  );

  const closingSoon = shortlist.ownGroup
    .map((entry) => ({ entry, state: deadlineState(entry.edition.registrationDeadlineDate) }))
    .filter((item): item is { entry: PlannerEntry; state: SoonState } => item.state.kind === "soon")
    .sort((a, b) => a.state.daysLeft - b.state.daysLeft);

  const months = groupByMonth(shortlist.ownGroup, (entry) => entry.edition.startDate);

  return (
    <div>
      {closingSoon.length > 0 && (
        <div
          role="note"
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <Clock className="h-4 w-4" aria-hidden />
            Entries closing soon
          </p>
          <ul className="mt-2 space-y-1">
            {closingSoon.map(({ entry, state }) => (
              <li key={entry.edition.slug ?? entry.edition.name}>
                {entry.edition.name}: closes {formatLongDate(state.date)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {months.length === 0 ? (
        <p className="text-sm leading-relaxed text-slate-600">
          Nothing in their own age group is open on the calendar right now. The federation publishes
          about ten weeks ahead, so this fills in as events are announced.
        </p>
      ) : (
        months.map((month) => (
          <section key={month.key} aria-labelledby={`month-${month.key}`} className="mb-6">
            <h3
              id={`month-${month.key}`}
              className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500"
            >
              {month.label}
            </h3>
            <ul className="space-y-3">{month.items.map((entry) => renderCard(entry, "open"))}</ul>
          </section>
        ))
      )}

      {shortlist.playingUp.length > 0 && (
        <Disclosure label="Events in an older age group" count={shortlist.playingUp.length}>
          <ul className="space-y-3">
            {shortlist.playingUp.map((entry) => renderCard(entry, "open"))}
          </ul>
        </Disclosure>
      )}

      {shortlist.unknown.length > 0 && (
        <Disclosure label="Check the fact sheet first" count={shortlist.unknown.length}>
          <ul className="space-y-3">
            {shortlist.unknown.map((entry) => renderCard(entry, "closed"))}
          </ul>
        </Disclosure>
      )}

      {shortlist.closed.length > 0 && (
        <Disclosure label="Events they cannot enter" count={shortlist.closed.length}>
          <ul className="space-y-3">
            {shortlist.closed.map((entry) => renderCard(entry, "closed"))}
          </ul>
        </Disclosure>
      )}

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        Open means not barred by the published entry rules. Above Championship Series a draw is cut
        by ranking, so a place is earned rather than granted. Check each event&apos;s fact sheet
        before you travel.
      </p>
    </div>
  );
}
