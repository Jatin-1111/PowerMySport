"use client";

import { nextStepHref } from "@/modules/player/config/dependentNextStep";
import { useProfile } from "@/modules/auth/hooks/useProfile";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { calculateDependentCompletion } from "@/modules/player/utils/dependentCompletion";
import { denormalizeDependent } from "@/modules/player/utils/dependentNormalize";
import type { Dependent } from "@/types";
import { useMemo } from "react";

/**
 * The signed-in parent's children, scored and ready to render.
 *
 * Deliberately a `select` over `useProfile()` rather than its own request:
 * `/auth/profile` already returns `dependents[]`, so a second endpoint would
 * fetch data the page has in hand and give the two copies separate chances to
 * disagree.
 *
 * Scoring lives here, once, for a specific reason: `calculateDependentCompletion`
 * reads the *flat* wire shape, but every dependent that comes back from the API
 * has already been run through `normalizeDependent` into the nested shape (see
 * `fetchProfile` in `useProfile.ts`). Score a nested dependent directly and every
 * field reads as absent — the ring silently shows 0% for a fully-filled profile.
 * `denormalizeDependent` flattens it back, matching what the dependent detail
 * page does.
 */

export interface DependentGap {
  field: string;
  label: string;
  weight: number;
  /** Where the parent goes to fill this in. */
  href: string;
}

export interface DependentSummary {
  id: string;
  name: string;
  age: number | null;
  /** Chosen sport, else the first sport of interest, else null. */
  sport: string | null;
  completionPercent: number;
  /** The most valuable unfilled field, or null at 100%. */
  topGap: DependentGap | null;
  /** True once the Discover wizard or a current-standing tier has been recorded. */
  hasAssessment: boolean;
  /** True when a sport has been explicitly chosen, not merely listed as an interest. */
  hasChosenSport: boolean;
  dependent: Dependent;
}

const summarize = (dependent: Dependent): DependentSummary | null => {
  const id = dependent._id?.toString();
  if (!id) return null;

  const { percent, missing } = calculateDependentCompletion(denormalizeDependent(dependent));

  // `missing` arrives in field-declaration order, not by importance. Sorting by
  // weight is what makes "one CTA per child" the *highest-value* next action
  // rather than whichever gap happens to be declared first.
  const [top] = [...missing].sort((a, b) => b.weight - a.weight);

  return {
    id,
    name: dependent.name || "Child",
    age: getDependentAge(dependent.dob) ?? dependent.age ?? null,
    sport: dependent.sport?.chosenSport || dependent.sport?.sportsFocus?.[0] || null,
    completionPercent: percent,
    topGap: top ? { ...top, href: nextStepHref(id, top.field) } : null,
    // The scorer already decides what "we know where this child stands" means
    // (wizard completed, or a current-standing tier recorded). Reading it back
    // off `missing` keeps that definition in one place instead of restating it.
    hasAssessment: !missing.some((m) => m.field === "assessment"),
    hasChosenSport: Boolean(dependent.sport?.chosenSport),
    dependent,
  };
};

export interface UseDependentsResult {
  dependents: DependentSummary[];
  /** Children whose profile is not yet complete. Drives the action pill. */
  incompleteCount: number;
  isLoading: boolean;
  isError: boolean;
}

export const useDependents = (): UseDependentsResult => {
  const { data: user, isLoading, isError } = useProfile();

  const dependents = useMemo(
    () => (user?.dependents ?? []).map(summarize).filter((d): d is DependentSummary => d !== null),
    [user?.dependents]
  );

  return {
    dependents,
    incompleteCount: dependents.filter((d) => d.completionPercent < 100).length,
    isLoading,
    isError,
  };
};
