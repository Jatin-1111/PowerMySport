"use client";

import { PlannerBoard } from "@/modules/planner/components/PlannerBoard";
import { PlannerLanding } from "@/modules/planner/components/PlannerLanding";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { useDependents } from "@/modules/player/hooks/useDependents";
import { rankedSportFor } from "@/modules/player/services/rankingClaim";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { cn } from "@/utils/cn";
import Link from "next/link";
import { useState } from "react";

/**
 * The planner's front door: it decides what this visitor sees before any child
 * is chosen.
 *
 *   signed out        the landing page, which explains the tool and asks them in
 *   not a parent      a plain note, because the planner is built around a child
 *   no children yet   a pointer to add one
 *   otherwise         a child picker and that child's board
 *
 * Nothing here is gated by a redirect. The page is public so it can be found and
 * read, and the personal part simply does not render for someone it cannot serve.
 */

const PLANNER_ROLES = new Set(["Parent", "Player"]);

export function PlannerApp() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const { dependents, isLoading } = useDependents();
  const [chosenId, setChosenId] = useState<string | null>(null);

  if (!hydrated) {
    // The session is still being read. Showing the landing page now would flash
    // "sign in" at someone who is signed in.
    return <Skeleton className="h-64 w-full" />;
  }

  if (!user || !token) return <PlannerLanding />;

  if (!PLANNER_ROLES.has(user.role)) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm leading-relaxed text-slate-700">
          The planner is built for parents and players planning a child&apos;s season. Your account
          is a different kind, so there is nothing to plan here.
        </p>
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (dependents.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-title text-lg font-extrabold text-slate-900">Add a player first</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          The planner works from a child&apos;s age group and ranking, so it needs a player profile
          to start from.
        </p>
        <Link
          href="/dashboard"
          className="mt-3 inline-block text-sm font-semibold text-orange-700 hover:underline"
        >
          Go to your dashboard
        </Link>
      </div>
    );
  }

  // Prefer a child who plays tennis: it is the one sport the planner covers, and
  // opening on a child it cannot help would make the page look broken.
  const fallback = dependents.find((child) => rankedSportFor([child.sport])) ?? dependents[0]!;
  const current = dependents.find((child) => child.id === chosenId) ?? fallback;

  return (
    <div className="space-y-6">
      {dependents.length > 1 && (
        <div role="tablist" aria-label="Choose a player" className="flex flex-wrap gap-2">
          {dependents.map((child) => {
            const selected = child.id === current.id;
            return (
              <button
                key={child.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setChosenId(child.id)}
                className={cn(
                  "min-h-10 rounded-lg border px-4 text-sm font-semibold transition",
                  selected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                {child.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Keyed by child so switching starts every board from a clean state:
          open disclosures, a half-open modal, nothing carries over. */}
      <PlannerBoard
        key={current.id}
        dependentId={current.id}
        dependentName={current.name}
        sport={current.sport}
      />
    </div>
  );
}
