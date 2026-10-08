import type { PlannerStanding } from "@/modules/planner/services/planner";

/**
 * Where the child stands, in the words a parent would use.
 *
 * A child is often ranked in more than one list: a U-16 who also plays U-18 events
 * appears in both. The planner works in one age group (the one their birth year gives)
 * and the others are shown so the parent is never left wondering where a rank went.
 * A child who has only played up may have no rank in their own age group yet, and the
 * sentence says so instead of printing a rank that is not theirs.
 */

/** "431 in U-18", "671 in U-14 and 834 in U-16". */
export function alsoRankedText(alsoRanked: PlannerStanding["alsoRanked"]): string | null {
  const parts = alsoRanked.map((list) => `${list.rank} in ${list.subcategory}`);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The "ranked 341" part of a sentence, or why there is none. */
export function rankClause(standing: Pick<PlannerStanding, "rank" | "subcategory">): string {
  return standing.rank === null
    ? `not ranked in ${standing.subcategory} yet`
    : `ranked ${standing.rank}`;
}

/** The line under the child's name. `listDate` is the date already formatted. */
export function standingSentence(standing: PlannerStanding, listDate: string): string {
  const also = alsoRankedText(standing.alsoRanked);
  const head =
    standing.rank === null
      ? `${standing.category} ${standing.subcategory}, ${rankClause(standing)}.`
      : `${standing.category} ${standing.subcategory}, ${rankClause(standing)} on the list of ${listDate}.`;
  const tail =
    standing.rank !== null && !also
      ? "Tournaments are matched to this ranking."
      : `Tournaments are matched to ${standing.subcategory}.`;
  return [head, also ? `Also ranked ${also}.` : null, tail].filter(Boolean).join(" ");
}
