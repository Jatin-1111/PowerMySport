// ─── Dependent Profile Completion Scoring ───────────────────────────────────
//
// Unlike calculateProfileCompletion (shared with the parent's own SELF
// profile), this scoring is specific to dependents and factors in the
// pathway-assessment fields (physical/personality/comfort/practical +
// wizardCompletedAt) so a profile built entirely through the dependent
// profile builder — without ever visiting /pathway — can still reach 100%,
// and a completed assessment is reflected as real progress.

export interface DependentCompletionProfile {
  sportsFocus?: string[];
  location?: string;
  heightCm?: number;
  weightKg?: number;
  energyType?: string;
  teamIndividual?: number;
  focusStyle?: string;
  decisionStyle?: string;
  contactComfort?: string;
  environment?: string;
  waterComfort?: string;
  budgetRange?: string;
  ambition?: string;
  weeklyHoursCategory?: string;
  wizardCompletedAt?: string;
  currentStandingTier?: number;
  bestResultTier?: number;
}

export const DEPENDENT_COMPLETION_FIELDS: Array<{
  field: string;
  label: string;
  weight: number;
  isFilled: (p: DependentCompletionProfile) => boolean;
}> = [
  {
    field: "sportsFocus",
    label: "Sports interest",
    weight: 10,
    isFilled: (p) => (p.sportsFocus?.length ?? 0) > 0,
  },
  {
    field: "location",
    label: "Location",
    weight: 10,
    isFilled: (p) => !!p.location,
  },
  {
    field: "physical",
    label: "Physical profile",
    weight: 15,
    isFilled: (p) => !!p.heightCm && !!p.weightKg && !!p.energyType,
  },
  {
    field: "personality",
    label: "Personality & play style",
    weight: 15,
    isFilled: (p) => p.teamIndividual !== undefined && !!p.focusStyle && !!p.decisionStyle,
  },
  {
    field: "comfort",
    label: "Comfort preferences",
    weight: 15,
    isFilled: (p) => !!p.contactComfort && !!p.environment && !!p.waterComfort,
  },
  {
    field: "practical",
    label: "Practical details",
    weight: 15,
    isFilled: (p) => !!p.budgetRange && !!p.ambition && !!p.weeklyHoursCategory,
  },
  {
    field: "assessment",
    label: "Current standing",
    weight: 20,
    // Satisfied by either path: the Discover wizard's sport-match assessment,
    // or the "I know my sport" flow's standing/best-result tiers — both mean
    // "we know where this child currently stands."
    isFilled: (p) => !!p.wizardCompletedAt || (!!p.currentStandingTier && !!p.bestResultTier),
  },
];

export interface DependentCompletionResult {
  percent: number;
  missing: Array<{ field: string; label: string; weight: number }>;
}

export function calculateDependentCompletion(
  profile: DependentCompletionProfile | null | undefined,
): DependentCompletionResult {
  const safeProfile = profile ?? {};
  const totalWeight = DEPENDENT_COMPLETION_FIELDS.reduce((sum, f) => sum + f.weight, 0);

  let filledWeight = 0;
  const missing: DependentCompletionResult["missing"] = [];

  for (const f of DEPENDENT_COMPLETION_FIELDS) {
    if (f.isFilled(safeProfile)) {
      filledWeight += f.weight;
    } else {
      missing.push({ field: f.field, label: f.label, weight: f.weight });
    }
  }

  return {
    percent: totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 100,
    missing,
  };
}

const ARCHETYPE_TRAIT_FIELDS = ["physical", "personality", "comfort"];

/** True when the physical/personality/comfort trait buckets aren't all filled —
 * i.e. this profile only ever went through a sport-known flow, never the
 * Discover wizard's archetype questions. Used to gate cross-flow nudges that
 * offer to fill those traits in (guidance, expert booking). */
export function isMissingArchetypeTraits(profile: DependentCompletionProfile | null | undefined): boolean {
  const { missing } = calculateDependentCompletion(profile);
  return missing.some((m) => ARCHETYPE_TRAIT_FIELDS.includes(m.field));
}
