"use client";

import { DashboardSection } from "@/modules/player/components/dashboard/DashboardSection";
import { useDependents } from "@/modules/player/hooks/useDependents";
import { roadmapHref } from "@/modules/pathway/data/sports";
import { Button } from "@/modules/shared/ui/Button";
import { cn } from "@/utils/cn";
import { Check, Compass, Map } from "lucide-react";
import Link from "next/link";

/**
 * How far each child has got along the journey the product actually cares
 * about: know where they stand → pick a sport → follow its roadmap.
 *
 * Deliberately three states rather than a percentage. The completion ring on
 * the roster already answers "how filled in is this profile"; the useful
 * question here is a different one — "what stage are they at" — and a second
 * percentage next to the first would just read as a contradiction.
 */

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        done
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-500"
      )}
    >
      {done ? (
        <Check className="h-3 w-3" />
      ) : (
        <span className="h-3 w-3 rounded-full border border-slate-300" />
      )}
      {label}
    </span>
  );
}

export function SportJourneyCard() {
  const { dependents, isLoading, isError } = useDependents();

  // Nothing to chart until there is a child to chart. The roster right above
  // already handles the "add your first child" prompt, so repeating it here
  // would be two empty states stacked.
  if (!isLoading && dependents.length === 0) return null;

  return (
    <DashboardSection
      icon={Compass}
      title="Sport journey"
      description="Where each child is on the path from assessment to a training roadmap."
      isLoading={isLoading && dependents.length === 0}
      isError={isError}
      skeletonHeight="h-28"
    >
      <div className="space-y-3">
        {dependents.map((child) => (
          <div
            key={child.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{child.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Step done={child.hasAssessment} label="Assessed" />
                <Step done={child.hasChosenSport} label="Sport chosen" />
              </div>
            </div>

            <div className="shrink-0">
              {child.sport ? (
                <Link href={roadmapHref(child.sport)}>
                  <Button variant="outline" size="sm" icon={<Map size={14} />}>
                    {child.sport} roadmap
                  </Button>
                </Link>
              ) : (
                <Link href="/assessment/discover">
                  <Button variant="primary" size="sm" icon={<Compass size={14} />}>
                    Find their sport
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
