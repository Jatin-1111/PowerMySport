import {
  judgeReach,
  reachLabel,
  type AcceptanceSample,
  type PlannerEntry,
  type ReachVerdict,
} from "@powermysport/shared-types";

/**
 * For each event a child can enter: would they have got in, judged by who got in before?
 *
 * One lookup per level (a handful), not one per event: every event of a level, age group
 * and gender is judged against the same past events. The child's own age group is the one
 * judged, because the draw they would play is the one for their age. An event with no
 * level on record has no past events to compare, and gets no verdict rather than a guess.
 *
 * A failure to read the past events never fails the planner: the page and the
 * recommender work without verdicts, and say nothing about reach, which is the honest
 * thing when the evidence cannot be read.
 */

export type ReachLoader = (
  ladder: string,
  ageGroup: string,
  gender: "Boys" | "Girls"
) => Promise<AcceptanceSample[]>;

export async function reachFor(params: {
  entries: PlannerEntry[];
  ageGroup: string;
  gender: "Boys" | "Girls";
  rank: number | null;
  load: ReachLoader;
}): Promise<Record<string, ReachVerdict>> {
  const { entries, ageGroup, gender, rank, load } = params;
  const ladders = [
    ...new Set(entries.map((entry) => entry.edition.ladder).filter((l): l is string => Boolean(l))),
  ];

  const byLadder = new Map<string, ReachVerdict>();
  await Promise.all(
    ladders.map(async (ladder) => {
      try {
        const samples = await load(ladder, ageGroup, gender);
        byLadder.set(ladder, judgeReach(samples, rank, reachLabel(ladder, gender, ageGroup)));
      } catch {
        // No evidence readable: say nothing about this level.
      }
    })
  );

  const verdicts: Record<string, ReachVerdict> = {};
  for (const entry of entries) {
    const { slug, ladder } = entry.edition;
    const verdict = ladder ? byLadder.get(ladder) : undefined;
    if (slug && verdict) verdicts[slug] = verdict;
  }
  return verdicts;
}

/**
 * The same judgement for events in an older age group than the child's own.
 *
 * The draw a child would play is the youngest group of the event that is at or above their
 * own, and the rank that counts there is their rank in THAT list: kept as `alsoRanked` when
 * they are on it, and unranked when they are not, which is what AITA's draws treat them as.
 * An event whose groups cannot be read gets no verdict.
 */
export async function reachForPlayingUp(params: {
  entries: PlannerEntry[];
  ownAgeGroup: string;
  gender: "Boys" | "Girls";
  alsoRanked: Array<{ subcategory: string; rank: number }>;
  load: ReachLoader;
}): Promise<Record<string, ReachVerdict>> {
  const { entries, ownAgeGroup, gender, alsoRanked, load } = params;
  const ageOf = (value: string): number | null => {
    const match = /(\d{1,2})/.exec(value ?? "");
    return match ? Number(match[1]) : null;
  };
  const own = ageOf(ownAgeGroup);
  if (own === null) return {};

  const byGroup = new Map<string, PlannerEntry[]>();
  for (const entry of entries) {
    const usable = (entry.edition.ageGroups ?? [])
      .map(ageOf)
      .filter((age): age is number => age !== null && age >= own);
    if (usable.length === 0) continue;
    const group = `U-${Math.min(...usable)}`;
    byGroup.set(group, [...(byGroup.get(group) ?? []), entry]);
  }

  const verdicts: Record<string, ReachVerdict> = {};
  for (const [group, groupEntries] of byGroup) {
    const rank =
      alsoRanked.find((other) => ageOf(other.subcategory) === ageOf(group))?.rank ?? null;
    Object.assign(
      verdicts,
      await reachFor({ entries: groupEntries, ageGroup: group, gender, rank, load })
    );
  }
  return verdicts;
}

/** "Boys" and "Girls" are the only categories the junior lists have. */
export const genderOf = (category: string | null | undefined): "Boys" | "Girls" | null =>
  /^girls$/i.test(category ?? "") ? "Girls" : /^boys$/i.test(category ?? "") ? "Boys" : null;
