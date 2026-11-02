"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  reviewQueueApi,
  type ReviewKind,
  type ReviewQueue,
  type ReviewQueueRow,
} from "@/modules/admin/services/reviewQueue";
import { btn } from "@/modules/shared/ui/buttonStyles";
import { MetricStrip, Panel } from "@/modules/shared/ui/Panel";
import { EmptyState, ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { cn } from "@/utils/cn";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const KIND_LABEL: Record<ReviewKind, string> = {
  coach: "Coach",
  expert: "Expert",
  venue: "Venue",
  academy: "Academy",
};

const KIND_FILTERS: { id: ReviewKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "coach", label: "Coaches" },
  { id: "expert", label: "Experts" },
  { id: "venue", label: "Venues" },
  { id: "academy", label: "Academies" },
];

const STATUS_LABEL: Record<ReviewQueueRow["lifecycle"], string> = {
  SUBMITTED: "Submitted",
  NEEDS_INFO: "Needs information",
};

/** Where the decision is made. Coaches and venues have a page per record. */
const detailHref = (row: ReviewQueueRow): string => {
  switch (row.kind) {
    case "coach":
      return `/admin/coach-verification/${row.id}`;
    case "venue":
      return `/admin/venues/${row.id}`;
    case "expert":
      return "/admin/experts";
    case "academy":
      return "/admin/academies";
  }
};

const waitedLabel = (days: number): string =>
  days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<ReviewKind | "all">("all");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    reviewQueueApi
      .list()
      .then(setQueue)
      .catch(() => setError("Could not load the review queue."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    reviewQueueApi
      .list()
      .then((data) => {
        if (active) setQueue(data);
      })
      .catch(() => {
        if (active) setError("Could not load the review queue.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = (queue?.rows ?? []).filter((row) => kind === "all" || row.kind === kind);
  const overdueCount = (queue?.rows ?? []).filter((row) => row.overdue).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="People"
        title="Review queue"
        subtitle="Everyone waiting on a decision, across coaches, experts, venues and academies. Oldest first."
      />

      <MetricStrip
        items={[
          { label: "Waiting", value: String(queue?.rows.length ?? 0) },
          {
            label: `Overdue (over ${queue?.overdueAfterDays ?? 5} days)`,
            value: String(overdueCount),
          },
        ]}
      />

      <Panel
        title="Waiting for a decision"
        description="Open a row to approve, reject or ask for more."
        action={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
            {KIND_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={kind === option.id}
                onClick={() => setKind(option.id)}
                className={cn(btn(kind === option.id ? "primary" : "outline", "sm"))}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <SkeletonBlock rows={5} label="Loading the review queue" />
        ) : error ? (
          <ErrorNotice message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            description="New submissions from coaches, experts, venues and academies appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-200">
            {rows.map((row) => (
              <li
                key={`${row.kind}:${row.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {row.name}{" "}
                    <span className="font-normal text-slate-500">{KIND_LABEL[row.kind]}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Waiting {waitedLabel(row.ageDays)}
                    {row.waitingOn ? `, on ${row.waitingOn.toLowerCase()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.overdue && <StatusBadge status="Overdue" tone="red" />}
                  <StatusBadge
                    status={STATUS_LABEL[row.lifecycle]}
                    tone={row.lifecycle === "NEEDS_INFO" ? "blue" : "amber"}
                  />
                  <Link href={detailHref(row)} className={btn("outline", "sm")}>
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
