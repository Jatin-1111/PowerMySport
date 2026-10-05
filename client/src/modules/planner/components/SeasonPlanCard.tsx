"use client";

import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import { PlanEntryRow } from "@/modules/planner/components/PlanEntryRow";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { ClipboardList } from "lucide-react";

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
            {entries.map((entry) => (
              <PlanEntryRow
                key={entry.editionSlug}
                entry={entry}
                busy={setStatus.isPending || remove.isPending}
                onAdvance={(status) => setStatus.mutate({ editionSlug: entry.editionSlug, status })}
                onRemove={() => remove.mutate(entry.editionSlug)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
