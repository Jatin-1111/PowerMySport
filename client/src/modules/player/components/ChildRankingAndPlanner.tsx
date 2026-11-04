"use client";

import { PlannerSection } from "@/modules/planner/components/PlannerSection";
import { RankingLinkCard } from "@/modules/player/components/RankingLinkCard";
import type { ComponentProps } from "react";

/**
 * The federation ranking and the season planner, as one block on a child's page.
 *
 * It exists so the page spends a few lines on both. That page is past the 400-line limit and
 * under a ratchet, and putting the My Child section on it meant making room, not raising the
 * budget.
 *
 * The ranking card renders nothing unless this child plays a sport whose ranking list we mirror,
 * or already has a link. The planner section renders itself only once a ranking is linked.
 */
export function ChildRankingAndPlanner({
  dependentId,
  dependentName,
  sports,
}: ComponentProps<typeof RankingLinkCard>) {
  return (
    <>
      <RankingLinkCard dependentId={dependentId} dependentName={dependentName} sports={sports} />
      <PlannerSection dependentId={dependentId} />
    </>
  );
}
