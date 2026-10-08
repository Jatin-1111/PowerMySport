"use client";

import { CostLine } from "@/modules/planner/components/CostLine";
import { DeadlineLine } from "@/modules/planner/components/DeadlineLine";
import { EventActions } from "@/modules/planner/components/EventActions";
import { OfficialDetails } from "@/modules/planner/components/OfficialDetails";
import { ReachNote } from "@/modules/planner/components/ReachNote";
import type { ReachVerdict } from "@powermysport/shared-types";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import type { EventCost } from "@/modules/planner/services/planner";
import { nextStatus, STATUS_LABEL } from "@/modules/planner/services/seasonPlan";
import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import { eventLocation } from "@/modules/planner/utils/calendarLinks";
import { formatEventWindow } from "@/modules/planner/utils/eventFormat";
import { OPEN_BADGE, STATUS_BADGE, SUGGESTED_BADGE } from "@/modules/planner/utils/statusStyle";
import { Badge } from "@/modules/shared/ui/Badge";
import { Button } from "@/modules/shared/ui/Button";
import { AlertTriangle, Info, X } from "lucide-react";
import Link from "next/link";

/**
 * Everything about one event, in one place.
 *
 * The calendar bars and the lists carry only what is needed to recognise an event.
 * This holds the rest: why it was suggested, what the entry rules say, what it may
 * cost and how to change that, when entries close, and what a parent can do with
 * it. Putting it here once, rather than on every card, is what keeps the cards
 * short enough to scan.
 *
 * Used inline beside the calendar on a wide screen and inside a dialog on a narrow
 * one. It does not know which, so the same content is never written twice.
 */

function stateChip(item: CalendarItem): { label: string; tone: string } {
  if (item.kind === "planned") {
    const status = item.status ?? "shortlisted";
    return {
      label: `On the plan, ${STATUS_LABEL[status].toLowerCase()}`,
      tone: STATUS_BADGE[status],
    };
  }
  if (item.kind === "suggested") {
    return {
      label: item.tier === "consider" ? "Worth considering" : "Suggested",
      tone: SUGGESTED_BADGE,
    };
  }
  return { label: "Open to enter", tone: OPEN_BADGE };
}

function SubHeading({
  level,
  className,
  children,
}: {
  level: "h3" | "h4";
  className: string;
  children: React.ReactNode;
}) {
  const Tag = level;
  return <Tag className={className}>{children}</Tag>;
}

export function EventDetail({
  item,
  dependentId,
  cost,
  costsLoading,
  heading = true,
  reach,
  onClose,
}: {
  item: CalendarItem;
  dependentId: string;
  cost: EventCost | undefined;
  costsLoading: boolean;
  /** False inside a dialog, which already shows the name as its title. */
  heading?: boolean;
  /** What past draws showed for this event, when they showed anything. */
  reach?: ReachVerdict | undefined;
  onClose?: () => void;
}) {
  const { add, setStatus, remove, setCosts, plannedSlugs } = useSeasonPlan(dependentId);
  const { edition } = item;
  const chip = stateChip(item);
  const planned = item.kind === "planned";
  const advance = planned ? nextStatus(item.status ?? "shortlisted") : null;
  const busy = add.isPending || setStatus.isPending || remove.isPending;
  const location = eventLocation({ ...edition, venue: undefined });
  const subLevel = heading ? "h4" : "h3";

  return (
    <div className="space-y-4 text-sm">
      {heading && (
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-title text-base font-extrabold leading-snug text-slate-900">
            {edition.slug ? (
              <Link href={`/tournaments/${edition.slug}`} className="hover:underline">
                {item.name}
              </Link>
            ) : (
              item.name
            )}
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={`${chip.tone} text-[11px]`}>
          {chip.label}
        </Badge>
        {edition.ladder && (
          <Badge variant="outline" className="border-slate-200 bg-white text-[11px] text-slate-700">
            {edition.ladder}
          </Badge>
        )}
        {item.verdict?.playingUp && (
          <Badge variant="outline" className="border-slate-200 bg-white text-[11px] text-slate-700">
            Older age group
          </Badge>
        )}
      </div>

      <dl className="space-y-1 text-slate-700">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Dates</dt>
          <dd>{formatEventWindow(item.startDate, item.endDate)}</dd>
        </div>
        {location && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Where</dt>
            <dd className="text-right">{location}</dd>
          </div>
        )}
        {edition.ageGroups && edition.ageGroups.length > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Age groups</dt>
            <dd className="text-right">
              {edition.ageGroups.map((group) => group.replace("-", " ")).join(", ")}
            </dd>
          </div>
        )}
        {/* Entries are the question until the event is entered; after that the
            withdrawal deadline is, and it is under "From AITA". */}
        {!(planned && item.status !== "shortlisted") && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Entries</dt>
            <dd className="text-right">
              <DeadlineLine
                deadline={edition.registrationDeadlineDate}
                time={edition.official?.times?.entryCloses}
              />
            </dd>
          </div>
        )}
      </dl>

      {item.clashes.length > 0 && (
        <ul className="space-y-1">
          {item.clashes.map((message) => (
            <li
              key={message}
              className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-relaxed text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {message}
            </li>
          ))}
        </ul>
      )}

      {item.reason && (
        <div>
          <SubHeading
            level={subLevel}
            className="text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Why it is suggested
          </SubHeading>
          <p className="mt-1 leading-relaxed text-slate-800">{item.reason}</p>
        </div>
      )}

      {item.verdict && (
        <div>
          <SubHeading
            level={subLevel}
            className="text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Entry rules
          </SubHeading>
          <p className="mt-1 leading-relaxed text-slate-800">{item.verdict.reason}</p>
          {item.verdict.notes.length > 0 && (
            <p className="mt-1 flex gap-1.5 text-xs leading-relaxed text-slate-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{item.verdict.notes.join(" ")}</span>
            </p>
          )}
        </div>
      )}

      {reach && (
        <div>
          <SubHeading
            level={subLevel}
            className="text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Who got in before
          </SubHeading>
          <div className="mt-1">
            <ReachNote verdict={reach} detail />
          </div>
        </div>
      )}

      {edition.official && (
        <div>
          <SubHeading
            level={subLevel}
            className="text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            From AITA
          </SubHeading>
          <div className="mt-1">
            <OfficialDetails edition={edition} entered={planned && item.status === "entered"} />
          </div>
        </div>
      )}

      {item.status !== "played" && (
        <div>
          <SubHeading
            level={subLevel}
            className="text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Cost
          </SubHeading>
          <CostLine
            cost={cost}
            loading={costsLoading}
            yours={item.planEntry?.costs}
            saving={setCosts.isPending}
            onSave={
              planned
                ? (figures) => setCosts.mutate({ editionSlug: item.slug, costs: figures })
                : undefined
            }
          />
          {!planned && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Add the event to the plan to enter your own figures, including the entry fee.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <EventActions
          edition={edition}
          isPlanned={plannedSlugs.has(item.slug)}
          isAdding={add.isPending}
          onAdd={() => add.mutate(item.slug)}
        />
        {planned && (
          <div className="flex flex-wrap items-center gap-2">
            {advance && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setStatus.mutate({ editionSlug: item.slug, status: advance })}
              >
                Mark {STATUS_LABEL[advance].toLowerCase()}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => remove.mutate(item.slug)}
              className="text-slate-600"
            >
              Remove from plan
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
