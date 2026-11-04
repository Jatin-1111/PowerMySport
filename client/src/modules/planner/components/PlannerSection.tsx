"use client";

import { SeasonPlanCard } from "@/modules/planner/components/SeasonPlanCard";
import { UpcomingFixturesCard } from "@/modules/planner/components/UpcomingFixturesCard";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Both halves of the planner, in the order a parent reads them.
 *
 * The decisions they have already made come first; the events they could still
 * choose come second. Each card hides itself when it has nothing to say, so a
 * child with no linked ranking renders nothing at all.
 *
 * It exists as one component so the dependent page spends a single line on the
 * whole feature. That page is already past the 400-line limit and under a
 * ratchet, and "add another card" should not mean "raise the budget again".
 */
export function PlannerSection({ dependentId }: { dependentId: string }) {
  return (
    <>
      <SeasonPlanCard dependentId={dependentId} />
      <UpcomingFixturesCard dependentId={dependentId} />
      <Link
        href="/planner"
        className="inline-flex items-center gap-1 text-sm font-semibold text-orange-700 hover:underline"
      >
        Open the full season planner
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </>
  );
}
