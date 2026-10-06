"use client";

import {
  nextStatus,
  STATUS_LABEL,
  type SeasonPlanEntry,
  type SeasonPlanEntryStatus,
} from "@/modules/planner/services/seasonPlan";
import { formatEventWindow } from "@/modules/planner/utils/eventFormat";
import { STATUS_BADGE } from "@/modules/planner/utils/statusStyle";
import { Badge } from "@/modules/shared/ui/Badge";
import { Button } from "@/modules/shared/ui/Button";
import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One tournament on a plan, and what a parent can do to it.
 *
 * Shared by the dashboard card and the planner page so the two cannot drift: the
 * status tones, the "mark entered" step and the remove control are the same
 * wherever a plan is shown. What differs is passed in, never forked.
 */

export function PlanEntryRow({
  entry,
  endDate,
  location,
  warning,
  extraActions,
  details,
  busy,
  onAdvance,
  onRemove,
}: {
  entry: SeasonPlanEntry;
  /** Joined from the live calendar when it still holds the event. */
  endDate?: string | null | undefined;
  location?: string | undefined;
  /** A clash or tight gap against the event before it. */
  warning?: string | undefined;
  extraActions?: ReactNode;
  /** Anything that belongs under the row, such as what the event is expected to cost. */
  details?: ReactNode;
  busy: boolean;
  onAdvance: (status: SeasonPlanEntryStatus) => void;
  onRemove: () => void;
}) {
  const advance = nextStatus(entry.status);
  return (
    <li className="border-b border-slate-100 py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-slate-900">
            <Link href={`/tournaments/${entry.editionSlug}`} className="hover:underline">
              {entry.name}
            </Link>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatEventWindow(entry.startDate, endDate)}
            {location ? ` · ${location}` : ""}
            {entry.note ? ` · ${entry.note}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className={`${STATUS_BADGE[entry.status]} text-[11px]`}>
            {STATUS_LABEL[entry.status]}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${entry.name} from the plan`}
            disabled={busy}
            onClick={onRemove}
            className="text-slate-400"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
      {details}
      {(extraActions || advance) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {extraActions}
          {advance && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onAdvance(advance)}>
              Mark {STATUS_LABEL[advance].toLowerCase()}
            </Button>
          )}
        </div>
      )}
      {warning && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{warning}</span>
        </p>
      )}
    </li>
  );
}
