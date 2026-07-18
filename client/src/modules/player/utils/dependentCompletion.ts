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
    label: "Sport match results",
    weight: 20,
    isFilled: (p) => !!p.wizardCompletedAt,
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
