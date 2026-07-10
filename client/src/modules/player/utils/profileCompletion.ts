// ─── Profile Completion Scoring ─────────────────────────────────────────────
//
// Used for both the parent's own ("SELF") player profile and each dependent's
// profile — both expose the exact same optional field set via the API, so one
// shared weighting works for both without special-casing.
//
// `name`/`dob`/`relation` are required at creation time (the form can't be
// submitted without them), so they're always 100% filled and excluded here —
// weighting them would just inflate every profile's floor without ever
// reflecting real user action. `gender` is excluded too: it's collected for
// dependents but never asked of a parent's own profile, so including it would
// make the parent's own ring permanently unable to reach 100%.
//
// Weights favor the fields that actually drive recommendations/AI guidance
// (sports, objective, location) over lower-signal extras (personality tags,
// experience).

export interface CompletionProfile {
  sportsFocus?: string[];
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: string;
  weeklyTimeCommitment?: number;
  budgetTier?: string;
  location?: string;
}

export const PROFILE_COMPLETION_FIELDS: Array<{
  field: keyof CompletionProfile;
  label: string;
  weight: number;
  isFilled: (p: CompletionProfile) => boolean;
}> = [
  {
    field: "sportsFocus",
    label: "Sports",
    weight: 25,
    isFilled: (p) => (p.sportsFocus?.length ?? 0) > 0,
  },
  {
    field: "primaryObjective",
    label: "Objective",
    weight: 20,
    isFilled: (p) => !!p.primaryObjective,
  },
  {
    field: "location",
    label: "State / Location",
    weight: 15,
    isFilled: (p) => !!p.location,
  },
  {
    field: "yearsPlaying",
    label: "Experience",
    weight: 10,
    isFilled: (p) => p.yearsPlaying !== undefined && p.yearsPlaying !== null,
  },
  {
    field: "weeklyTimeCommitment",
    label: "Weekly Time Commitment",
    weight: 10,
    isFilled: (p) => !!p.weeklyTimeCommitment,
  },
  {
    field: "budgetTier",
    label: "Budget Tier",
    weight: 10,
    isFilled: (p) => !!p.budgetTier,
  },
  {
    field: "personalityTags",
    label: "Personality Tags",
    weight: 10,
    isFilled: (p) => (p.personalityTags?.length ?? 0) > 0,
  },
];

export interface ProfileCompletionResult {
  percent: number;
  missing: Array<{ field: string; label: string; weight: number }>;
}

export function calculateProfileCompletion(
  profile: CompletionProfile | null | undefined,
): ProfileCompletionResult {
  const safeProfile = profile ?? {};
  const totalWeight = PROFILE_COMPLETION_FIELDS.reduce(
    (sum, f) => sum + f.weight,
    0,
  );

  let filledWeight = 0;
  const missing: ProfileCompletionResult["missing"] = [];

  for (const f of PROFILE_COMPLETION_FIELDS) {
    if (f.isFilled(safeProfile)) {
      filledWeight += f.weight;
    } else {
      missing.push({ field: f.field, label: f.label, weight: f.weight });
    }
  }

  return {
    percent:
      totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 100,
    missing,
  };
}
