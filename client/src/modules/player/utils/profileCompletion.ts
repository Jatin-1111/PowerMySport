// ─── Profile Completion Scoring ─────────────────────────────────────────────
//
// Scores the account holder's own profile. Dependents have their own,
// separate weighting in `dependentCompletion.ts`.
//
// There are two field sets, because there are two forms. A Player fills in a
// SELF player profile (sports, experience). A Parent is never shown those
// inputs at all — `PlayerProfileEditForm` branches on `isParent` and collects
// background, sports followed and years involved instead, which save to
// `parentProfile` on the user rather than to a SELF `Player` record.
//
// Scoring a parent against the player fields is what pinned every parent
// account at 0% no matter how much they filled in, so the field set has to
// follow the role the same way the form does.
//
// `name`/`dob`/`relation` are required at creation time (the form can't be
// submitted without them), so they're always 100% filled and excluded here —
// weighting them would just inflate every profile's floor without ever
// reflecting real user action.
//
// The "AI Guidance Preferences" fields (objective, budget, location, weekly
// time, personality tags) were dropped from both scoring and the profile UI —
// the product no longer collects them here.

export interface CompletionProfile {
  sportsFocus?: string[];
  yearsPlaying?: number;
}

export interface ParentCompletionProfile {
  bio?: string;
  sportInterests?: string[];
  involvementYears?: number;
}

/** The shape the scorer needs off a user — a subset of `User`. */
export interface CompletionSubject {
  role?: string;
  playerProfile?: CompletionProfile | null;
  parentProfile?: ParentCompletionProfile | null;
}

interface CompletionField<T> {
  field: string;
  label: string;
  weight: number;
  isFilled: (p: T) => boolean;
}

export const PROFILE_COMPLETION_FIELDS: Array<CompletionField<CompletionProfile>> = [
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

export const PARENT_COMPLETION_FIELDS: Array<CompletionField<ParentCompletionProfile>> = [
  {
    field: "sportInterests",
    label: "Sports you follow",
    weight: 25,
    isFilled: (p) => (p.sportInterests?.length ?? 0) > 0,
  },
  {
    field: "involvementYears",
    label: "Years involved",
    weight: 10,
    isFilled: (p) => p.involvementYears !== undefined && p.involvementYears !== null,
  },
  {
    field: "bio",
    label: "Background",
    weight: 10,
    isFilled: (p) => (p.bio?.trim().length ?? 0) > 0,
  },
];

export interface ProfileCompletionResult {
  percent: number;
  missing: Array<{ field: string; label: string; weight: number }>;
}

function score<T>(profile: T, fields: Array<CompletionField<T>>): ProfileCompletionResult {
  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);

  let filledWeight = 0;
  const missing: ProfileCompletionResult["missing"] = [];

  for (const f of fields) {
    if (f.isFilled(profile)) {
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

/**
 * Scores whichever profile the user is actually asked to fill in: the parent
 * background for a Parent, the SELF player profile for everyone else.
 */
export function calculateProfileCompletion(
  user: CompletionSubject | null | undefined
): ProfileCompletionResult {
  if (user?.role === "Parent") {
    return score(user.parentProfile ?? {}, PARENT_COMPLETION_FIELDS);
  }
  return score(user?.playerProfile ?? {}, PROFILE_COMPLETION_FIELDS);
}
