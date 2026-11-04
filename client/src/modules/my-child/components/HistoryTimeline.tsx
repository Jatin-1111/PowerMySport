"use client";

import {
  CHILD_HISTORY_SOURCE_LABELS,
  type ChildShareSection,
  type ChildTimelineRow,
} from "@powermysport/shared-types";
import { SECTION_LABELS, formatEntryDate } from "@/modules/my-child/utils/format";
import { Button } from "@/modules/shared/ui/Button";
import { UnderlineFilter } from "@/modules/shared/ui/UnderlineFilter";
import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

type Filter = "all" | ChildShareSection;

/**
 * The journey, newest first, with a filter for the sections that have something in them.
 *
 * Every row says where it came from, because a reader gives a family's own word less weight than
 * a federation list. Only stored rows can be edited. A derived row (a ranking, the sport the
 * family chose) is read live and has nothing to edit; a tournament marked played offers
 * "Add result" instead.
 */
export function HistoryTimeline({
  rows,
  onEdit,
  onDelete,
  onAddResult,
}: {
  rows: ChildTimelineRow[];
  onEdit: (row: ChildTimelineRow) => void;
  onDelete: (row: ChildTimelineRow) => void;
  onAddResult: (row: ChildTimelineRow) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const sections = useMemo(() => {
    const counts = new Map<ChildShareSection, number>();
    for (const row of rows) counts.set(row.section, (counts.get(row.section) ?? 0) + 1);
    return [...counts.entries()];
  }, [rows]);

  const visible = filter === "all" ? rows : rows.filter((row) => row.section === filter);

  return (
    <div>
      {sections.length > 1 && (
        <UnderlineFilter
          label="Show"
          value={filter}
          onChange={setFilter}
          // The row scrolls sideways inside its own box. Without this its full width (six
          // sections) counts towards the page's width, and a phone is pushed out to 635px.
          className="w-0 min-w-full"
          items={[
            { label: "All", value: "all", count: rows.length },
            ...sections.map(([section, count]) => ({
              label: SECTION_LABELS[section],
              value: section,
              count,
            })),
          ]}
        />
      )}

      <ol className="divide-hairline divide-y">
        {visible.map((row) => (
          <li key={row.id} className="grid gap-x-6 gap-y-2 py-5 sm:grid-cols-[9rem_1fr_auto]">
            <p className="text-ink-body text-sm tabular-nums">
              {formatEntryDate(row.occurredOn, row.datePrecision)}
              {row.endedOn && (
                <>
                  <span aria-hidden> to </span>
                  <span className="sr-only"> to </span>
                  {formatEntryDate(row.endedOn, row.datePrecision)}
                </>
              )}
            </p>

            <div className="min-w-0">
              <p className="text-ink font-medium">
                {row.title}
                {row.resultLabel && (
                  <span className="text-ink-body font-normal"> · {row.resultLabel}</span>
                )}
              </p>
              {row.detail && <p className="text-ink-body mt-1 text-pretty text-sm">{row.detail}</p>}
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="border-hairline text-ink-body rounded-md border px-2 py-0.5 text-xs">
                  {CHILD_HISTORY_SOURCE_LABELS[row.source]}
                </span>
                {row.resultUrl && (
                  <a
                    href={row.resultUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-ink inline-flex min-h-11 items-center gap-1 underline underline-offset-2"
                  >
                    Result page
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
              </p>
            </div>

            <div className="flex items-start gap-2 sm:justify-end">
              {row.canAddResult && (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => onAddResult(row)}
                >
                  Add result
                </Button>
              )}
              {row.editable && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => onEdit(row)}
                    aria-label={`Edit ${row.title}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => onDelete(row)}
                    aria-label={`Remove ${row.title}`}
                  >
                    Remove
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
