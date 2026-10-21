/**
 * The words used to describe a child, declared once.
 *
 * Each of these lists was typed out by hand in up to ten places (the stored model, the
 * request validation, the service, and several client files), and the answers a parent gives
 * in the quiz, the guidance wizard and the profile form all have to be the same words or a
 * save fails. The model, the validation and every screen now import them from here.
 *
 * A UI that shows these with its own wording keys the labels by the type, for example
 * `Record<ChildBudgetRange, string>`, so a value added here is a compile error until each
 * screen has a label for it.
 */

export const CHILD_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type ChildGender = (typeof CHILD_GENDERS)[number];

/**
 * What the family wants from the sport. "professional" is kept for rows written before
 * "career" replaced it as the top option; the quiz no longer offers it.
 */
export const CHILD_AMBITIONS = [
  "fun",
  "competitive",
  "national",
  "career",
  "professional",
] as const;
export type ChildAmbition = (typeof CHILD_AMBITIONS)[number];

/** Monthly budget for the sport, in rupees. */
export const CHILD_BUDGET_RANGES = ["under-3k", "3k-7k", "7k-15k", "15k-plus"] as const;
export type ChildBudgetRange = (typeof CHILD_BUDGET_RANGES)[number];

/** Hours of training a week. */
export const CHILD_WEEKLY_HOURS = ["1-3", "4-7", "8-12", "13-plus"] as const;
export type ChildWeeklyHours = (typeof CHILD_WEEKLY_HOURS)[number];

export const CHILD_EXPERIENCE_LEVELS = ["beginner", "intermediate", "competitive"] as const;
export type ChildExperienceLevel = (typeof CHILD_EXPERIENCE_LEVELS)[number];

export const CHILD_TRAINING_TYPES = ["self", "club", "academy", "private"] as const;
export type ChildTrainingType = (typeof CHILD_TRAINING_TYPES)[number];
