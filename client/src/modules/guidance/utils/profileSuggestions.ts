import type { ConsultForm } from "@/modules/guidance/config/wizard/guidanceUtils";

/**
 * What a guidance run could update on the child it was run for.
 *
 * Guidance only ever suggests. The parent answers a set of questions to get a plan, and
 * some of those answers overlap with the child's profile; nothing is written until the
 * parent says so. (It used to write them back silently after every run, so a plan made
 * "what if they trained 8 hours" quietly changed the profile.)
 *
 * Only an answer that DIFFERS from what is stored is offered, so a parent who simply
 * confirmed the pre-filled values sees no prompt at all. The sport is not offered: a plan
 * for a sport says what the parent is asking about, not that the child plays it.
 */

export type SuggestedField =
  "gender" | "location" | "experienceLevel" | "weeklyHoursCategory" | "budgetRange";

export interface ProfileSuggestion {
  field: SuggestedField;
  label: string;
  /** What the profile says now, in words; null when it has nothing. */
  current: string | null;
  /** What the answers say, in words. */
  next: string;
  /** The value to save. */
  value: string;
}

/** The slice of a child this needs. */
export interface ChildForSuggestions {
  gender?: string | null;
  location?: string | null;
  experienceLevel?: string | null;
  weeklyHoursCategory?: string | null;
  budgetRange?: string | null;
}

const WORDS: Record<SuggestedField, Record<string, string>> = {
  gender: { MALE: "Boy", FEMALE: "Girl" },
  location: {},
  experienceLevel: {
    beginner: "Beginner",
    intermediate: "Intermediate",
    competitive: "Competitive",
  },
  weeklyHoursCategory: {
    "1-3": "1 to 3 hours a week",
    "4-7": "4 to 7 hours a week",
    "8-12": "8 to 12 hours a week",
    "13-plus": "13 or more hours a week",
  },
  budgetRange: {
    "under-3k": "Under ₹3,000",
    "3k-7k": "₹3,000 to ₹7,000",
    "7k-15k": "₹7,000 to ₹15,000",
    "15k-plus": "₹15,000 or more",
  },
};

const LABELS: Record<SuggestedField, string> = {
  gender: "Gender",
  location: "State",
  experienceLevel: "Experience level",
  weeklyHoursCategory: "Training time",
  budgetRange: "Budget",
};

const words = (field: SuggestedField, value: string | null | undefined): string | null =>
  value ? (WORDS[field][value] ?? value) : null;

export function profileSuggestions(
  child: ChildForSuggestions | null | undefined,
  form: Pick<ConsultForm, "gender" | "state" | "experienceLevel" | "weeklyHours" | "budgetRange">
): ProfileSuggestion[] {
  if (!child) return [];

  const answers: Array<[SuggestedField, string | null | undefined, string | null | undefined]> = [
    // Only two genders are offered by the question; "OTHER" on the profile is never overwritten.
    [
      "gender",
      form.gender === "MALE" || form.gender === "FEMALE" ? form.gender : null,
      child.gender,
    ],
    ["location", form.state, child.location],
    ["experienceLevel", form.experienceLevel, child.experienceLevel],
    ["weeklyHoursCategory", form.weeklyHours, child.weeklyHoursCategory],
    ["budgetRange", form.budgetRange, child.budgetRange],
  ];

  const suggestions: ProfileSuggestion[] = [];
  for (const [field, answered, stored] of answers) {
    if (!answered || answered === stored) continue;
    // A child recorded as OTHER keeps it: the question cannot express that answer.
    if (field === "gender" && stored === "OTHER") continue;
    suggestions.push({
      field,
      label: LABELS[field],
      current: words(field, stored),
      next: words(field, answered) as string,
      value: answered,
    });
  }
  return suggestions;
}
