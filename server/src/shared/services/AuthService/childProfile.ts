import { resolveChildAge } from "../../../utils/childAge";

/**
 * A child as the parent who owns them sees it: the one place that decides which of a
 * child's stored fields leave the server for the parent's own screens.
 *
 * `GET /auth/profile` (children embedded in the profile) and `GET /auth/players` (the
 * list the quiz, guidance and expert booking pre-fill from) both use this, so they can
 * never disagree. They used to be two hand-written lists: the profile one had quietly
 * lost `currentStandingTier`, so a child whose parent had named their level in "I know
 * my sport" never showed as assessed on the dashboard, while the other list still
 * returned it. A test fails when a field is added to the model and mapped nowhere.
 *
 * This is the parent's view only. What an expert sees (a short briefing, then the full
 * profile for a paid session) and what another parent sees (an age band) are separate on
 * purpose, and are never built from this.
 */
export const serializeChildForParent = (p: any) => ({
  _id: p._id,
  name: p.name,
  dob: p.dob || null,
  age: resolveChildAge(p),
  gender: p.gender,
  relation: p.relation,
  location: p.location,
  sportsFocus: p.sportsFocus || [],
  consideringSports: p.consideringSports || [],
  sportMatches: p.sportMatches || [],
  wizardCompletedAt: p.wizardCompletedAt,
  chosenSport: p.chosenSport,
  chosenSportAt: p.chosenSportAt,
  budgetRange: p.budgetRange,
  ambition: p.ambition,
  weeklyHoursCategory: p.weeklyHoursCategory,
  trainingType: p.trainingType,
  yearsPlaying: p.yearsPlaying,
  experienceLevel: p.experienceLevel,
  currentStandingTier: p.currentStandingTier,
  personalityTags: p.personalityTags,
  quiz: p.quiz ?? undefined,
});

/**
 * Stored fields that are deliberately NOT part of the parent's view of a child, with the
 * reason. The guard test requires every field of the model to be either returned by
 * `serializeChildForParent` or listed here.
 */
export const NOT_SENT_TO_THE_PARENT: Record<string, string> = {
  userId: "the owner's own id; the caller already knows it",
  type: "added by the players list itself, which mixes a parent's own row with children",
  createdAt: "internal bookkeeping",
  updatedAt: "internal bookkeeping",
  primaryObjective: "used only for an adult's own athlete row, never for a child",
  weeklyTimeCommitment: "used only for an adult's own athlete row, never for a child",
  budgetTier: "used only for an adult's own athlete row, never for a child",
};
