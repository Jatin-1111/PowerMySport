import type { AcademyCoachInput } from "@/modules/onboarding/types/academy";

/**
 * Rules for the coaches step of academy sign-up. These are people the academy
 * says work there; they have not agreed to be listed, so only a name, an email
 * and the sports are collected. The limits mirror the server's step 5 validator.
 */

export const MAX_ACADEMY_COACHES = 50;
export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 60;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createEmptyCoach = (): AcademyCoachInput => ({
  firstName: "",
  lastName: "",
  email: "",
  sports: [],
});

/** A row the owner added and never filled in. The step is optional, so it is dropped. */
export const isBlankCoach = (coach: AcademyCoachInput): boolean =>
  !coach.firstName.trim() &&
  !coach.lastName.trim() &&
  !coach.email.trim() &&
  coach.sports.length === 0;

export type CoachErrors = Partial<Record<"firstName" | "lastName" | "email" | "sports", string>>;

/**
 * What is wrong with each coach, by row index. `coaches` is the list that will be
 * saved (blank rows already dropped). An email used twice is flagged on the later
 * row, ignoring case and surrounding spaces.
 */
export const validateCoaches = (coaches: AcademyCoachInput[]): Record<number, CoachErrors> => {
  const errors: Record<number, CoachErrors> = {};
  const seen = new Set<string>();

  coaches.forEach((coach, index) => {
    const row: CoachErrors = {};
    const first = coach.firstName.trim();
    const last = coach.lastName.trim();
    const email = coach.email.trim().toLowerCase();

    if (first.length < MIN_NAME_LENGTH) row.firstName = "Enter a first name";
    else if (first.length > MAX_NAME_LENGTH) row.firstName = "That name is too long";
    if (last.length < MIN_NAME_LENGTH) row.lastName = "Enter a last name";
    else if (last.length > MAX_NAME_LENGTH) row.lastName = "That name is too long";

    if (!EMAIL.test(email)) row.email = "Enter a valid email";
    else if (seen.has(email)) row.email = "This email is already in the list";
    else seen.add(email);

    if (coach.sports.length === 0) row.sports = "Choose at least one sport";

    if (Object.keys(row).length > 0) errors[index] = row;
  });

  return errors;
};

/** The coaches as the server wants them: blank rows dropped, text trimmed, email lowercase. */
export const coachesForSave = (coaches: AcademyCoachInput[]): AcademyCoachInput[] =>
  coaches
    .filter((coach) => !isBlankCoach(coach))
    .map((coach) => ({
      firstName: coach.firstName.trim(),
      lastName: coach.lastName.trim(),
      email: coach.email.trim().toLowerCase(),
      sports: coach.sports,
    }));

/** Saved coaches reduced to the four fields, whatever older records carried. */
export const coachesFromSaved = (saved: unknown): AcademyCoachInput[] =>
  Array.isArray(saved)
    ? saved.map((raw) => {
        const coach = (raw ?? {}) as Partial<AcademyCoachInput>;
        return {
          firstName: String(coach.firstName ?? ""),
          lastName: String(coach.lastName ?? ""),
          email: String(coach.email ?? ""),
          sports: Array.isArray(coach.sports) ? coach.sports.map(String) : [],
        };
      })
    : [];
