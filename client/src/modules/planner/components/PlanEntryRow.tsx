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
import { QUICK } from "@/modules/planner/utils/motion";
import { motion } from "framer-motion";
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
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={QUICK}
      className="border-b border-slate-100 py-3 first:pt-0 last:border-0 last:pb-0"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold leading-snug text-slate-900">
            <Link href={`/tournaments/${entry.editionSlug}`} className="hover:underline">
              {entry.name}
            </Link>
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {formatEventWindow(entry.startDate, endDate)}
            {location ? ` · ${location}` : ""}
            {entry.note ? ` · ${entry.note}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:self-start">
          <Badge variant="outline" className={`${STATUS_BADGE[entry.status]} text-sm`}>
            {STATUS_LABEL[entry.status]}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${entry.name} from the plan`}
            disabled={busy}
            onClick={onRemove}
            className="text-slate-600"
          >
            <X className="mr-1 h-4 w-4" aria-hidden />
            Remove
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
      {advance === "entered" && !warning && (
        <p className="mt-2 text-sm text-slate-600">
          Entries are made on AITA. Mark it entered here once you have.
        </p>
      )}
      {warning && (
        <p className="mt-2 flex items-start gap-1.5 text-sm leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{warning}</span>
        </p>
      )}
    </motion.li>
  );
}
