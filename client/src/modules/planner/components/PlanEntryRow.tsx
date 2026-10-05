"use client";

import {
  nextStatus,
  STATUS_LABEL,
  type SeasonPlanEntry,
  type SeasonPlanEntryStatus,
} from "@/modules/planner/services/seasonPlan";
import { formatEventWindow } from "@/modules/planner/utils/eventFormat";
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

const TONE: Record<SeasonPlanEntryStatus, string> = {
  shortlisted: "border-slate-200 bg-slate-50 text-slate-600",
  entered: "border-amber-200 bg-amber-50 text-amber-700",
  played: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function PlanEntryRow({
  entry,
  endDate,
  location,
  warning,
  extraActions,
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
  busy: boolean;
  onAdvance: (status: SeasonPlanEntryStatus) => void;
  onRemove: () => void;
}) {
  const advance = nextStatus(entry.status);
  return (
    <li className="border-b border-slate-100 py-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
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

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`${TONE[entry.status]} text-[11px]`}>
            {STATUS_LABEL[entry.status]}
          </Badge>
          {extraActions}
          {advance && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onAdvance(advance)}>
              Mark {STATUS_LABEL[advance].toLowerCase()}
            </Button>
          )}
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
      {warning && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{warning}</span>
        </p>
      )}
    </li>
  );
}
