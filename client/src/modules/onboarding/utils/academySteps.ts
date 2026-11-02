/**
 * The academy sign-up steps, numbered exactly as the server numbers them.
 *
 * The server's onboarding API has seven steps and refuses payloads sent to the
 * wrong one. The public form used to run its own six-step numbering, so its
 * venues, pricing and payout calls landed on the wrong server steps. One list,
 * shared by the form, the progress bar and resume, keeps the two in step: step
 * N in the form is step N on the server. The server-side contract is pinned by
 * `server/src/tests/academyOnboardingJourney.integration.test.ts`.
 */
export const ACADEMY_STEPS = [
  { number: 1, key: "basic", title: "Basic info" },
  { number: 2, key: "location", title: "Location and contact" },
  { number: 3, key: "legal", title: "Legal and KYC" },
  { number: 4, key: "venues", title: "Venues" },
  { number: 5, key: "coaches", title: "Coaches" },
  { number: 6, key: "pricing", title: "Pricing and plans" },
  { number: 7, key: "payouts", title: "Payouts and terms" },
] as const;

export type AcademyStepNumber = (typeof ACADEMY_STEPS)[number]["number"];
export type AcademyStepKey = (typeof ACADEMY_STEPS)[number]["key"];

export const FIRST_ACADEMY_STEP: AcademyStepNumber = 1;
export const LAST_ACADEMY_STEP: AcademyStepNumber = 7;

/** Steps the server accepts through `PUT /onboarding/:id/step/:n` (step 1 is `start`). */
export const SAVEABLE_ACADEMY_STEPS = ACADEMY_STEPS.filter((s) => s.number >= 2).map(
  (s) => s.number
);

export const isAcademyStepNumber = (value: number): value is AcademyStepNumber =>
  Number.isInteger(value) && value >= FIRST_ACADEMY_STEP && value <= LAST_ACADEMY_STEP;

export const academyStepTitle = (step: number): string =>
  ACADEMY_STEPS.find((s) => s.number === step)?.title ?? "";

/**
 * Where to resume. The server's `onboardingStep` is the highest step already
 * saved, so the owner continues on the next one, and never past the last step.
 * A missing, zero or nonsensical value starts again at step 1.
 */
export const resumeStepFor = (serverStep: number | null | undefined): AcademyStepNumber => {
  if (!serverStep || !Number.isFinite(serverStep) || serverStep < 1) return FIRST_ACADEMY_STEP;
  return Math.min(Math.floor(serverStep) + 1, LAST_ACADEMY_STEP) as AcademyStepNumber;
};

/** Progress shown to the owner: steps saved out of seven, 0 to 100. */
export const academyProgressPercent = (serverStep: number | null | undefined): number => {
  if (!serverStep || !Number.isFinite(serverStep) || serverStep < 1) return 0;
  return Math.round(
    (Math.min(Math.floor(serverStep), LAST_ACADEMY_STEP) / LAST_ACADEMY_STEP) * 100
  );
};
