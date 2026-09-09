// ─── Profile Completion Scoring ─────────────────────────────────────────────
//
// Used for the parent's own ("SELF") player profile — the sports and
// experience they've entered for themselves. Dependents have their own,
// separate weighting in `dependentCompletion.ts`.
//
// `name`/`dob`/`relation` are required at creation time (the form can't be
// submitted without them), so they're always 100% filled and excluded here —
// weighting them would just inflate every profile's floor without ever
// reflecting real user action.
//
// The "AI Guidance Preferences" fields (objective, budget, location, weekly
// time, personality tags) were dropped from both scoring and the profile UI —
// the product no longer collects them here. Only sportsFocus and yearsPlaying
// remain, so a filled sports list and a filled experience figure is a complete
// profile.

export interface CompletionProfile {
  sportsFocus?: string[];
  yearsPlaying?: number;
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
    field: "yearsPlaying",
    label: "Experience",
    weight: 10,
    isFilled: (p) => p.yearsPlaying !== undefined && p.yearsPlaying !== null,
  },
];

export interface ProfileCompletionResult {
  percent: number;
  missing: Array<{ field: string; label: string; weight: number }>;
}

export function calculateProfileCompletion(
  profile: CompletionProfile | null | undefined
): ProfileCompletionResult {
  const safeProfile = profile ?? {};
  const totalWeight = PROFILE_COMPLETION_FIELDS.reduce((sum, f) => sum + f.weight, 0);

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
    percent: totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 100,
    missing,
  };
}
