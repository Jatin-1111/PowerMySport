"use client";

import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import {
  nextStatus,
  STATUS_LABEL,
  type SeasonPlanEntry,
} from "@/modules/planner/services/seasonPlan";
import { Badge } from "@/modules/shared/ui/Badge";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { ClipboardList, X } from "lucide-react";
import Link from "next/link";

/**
 * The tournaments a parent has decided on.
 *
 * ── Why this is separate from the eligibility list ──────────────────────────
 * One is advice, the other is a decision. The shortlist changes every time a
 * ranking list publishes; the plan only changes when the parent changes it. A
 * child dropping into the top 75 closes Talent Series in the shortlist, and
 * must not quietly delete the Talent Series event their parent already entered
 * them for.
 *
 * ── Why past entries stay ───────────────────────────────────────────────────
 * A tournament marked played is the record of a season. It stays on the plan
 * after its date, and after it leaves the federation's calendar, which is why
 * each entry carries the name and date it had when it was planned.
 */

const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

const TONE: Record<SeasonPlanEntry["status"], string> = {
  shortlisted: "border-slate-200 bg-slate-50 text-slate-600",
  entered: "border-amber-200 bg-amber-50 text-amber-700",
  played: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function SeasonPlanCard({ dependentId }: { dependentId: string }) {
  const { entries, isLoading, setStatus, remove } = useSeasonPlan(dependentId);

  // Nothing planned yet is not an empty state worth a card of its own: the
  // shortlist below is where a plan starts, and an empty box above it would
  // only push that further down the page.
  if (!isLoading && entries.length === 0) return null;

  return (
    <Card className="shop-surface premium-shadow overflow-hidden p-0">
      <ProfileSectionHeader
        icon={ClipboardList}
        title="Their plan"
        description="Tournaments you have chosen, in the order they happen."
      />
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : (
          <ul>
            {entries.map((entry) => {
              const advance = nextStatus(entry.status);
              return (
                <li
                  key={entry.editionSlug}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 py-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      <Link href={`/tournaments/${entry.editionSlug}`} className="hover:underline">
                        {entry.name}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {DATE.format(new Date(entry.startDate))}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={`${TONE[entry.status]} text-[11px]`}>
                      {STATUS_LABEL[entry.status]}
                    </Badge>
                    {advance && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({ editionSlug: entry.editionSlug, status: advance })
                        }
                      >
                        Mark {STATUS_LABEL[advance].toLowerCase()}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${entry.name} from the plan`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(entry.editionSlug)}
                      className="text-slate-400"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
