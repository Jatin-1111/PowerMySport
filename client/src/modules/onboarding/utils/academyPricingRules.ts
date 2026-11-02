import type { AcademyBatchTiming, AcademyPricingPayload } from "@/modules/onboarding/types/academy";

/**
 * Rules for the pricing step of academy sign-up. Money is held in paise, the way
 * the server stores it. The form shows rupees and converts at the edge (see
 * ./money), so nothing in here ever sees a rupee amount.
 */

export const MIN_RATE_PAISE = 100; // ₹1
export const MAX_RATE_PAISE = 100_000_000; // ₹10,00,000
export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 100;
export const DEFAULT_BATCH_SIZE = 20;

/** Two choices shown; ticking both is saved as "both" (see normalizeBatchTimings). */
export const BATCH_OPTIONS: { id: "morning" | "evening"; label: string }[] = [
  { id: "morning", label: "Morning (6 AM to 12 PM)" },
  { id: "evening", label: "Evening (3 PM to 9 PM)" },
];

/** Whether a timing shows as ticked: "both" ticks the two. */
export const isTimingTicked = (
  timings: AcademyBatchTiming[],
  timing: "morning" | "evening"
): boolean => timings.includes(timing) || timings.includes("both");

export interface PricingValues {
  ratePaise: number;
  batchTimings: AcademyBatchTiming[];
  maxBatchSize: number;
  trialOffered: boolean;
  trialPaise: number;
}

export const defaultPricing = (): PricingValues => ({
  ratePaise: 0,
  batchTimings: [],
  maxBatchSize: DEFAULT_BATCH_SIZE,
  trialOffered: false,
  trialPaise: 0,
});

/** Saved pricing back into form values. Missing fields fall back to the defaults. */
export const pricingFromSaved = (saved?: Partial<AcademyPricingPayload>): PricingValues => ({
  ratePaise: saved?.sessionRatePerHour ?? 0,
  batchTimings: saved?.batchTimings ?? [],
  maxBatchSize: saved?.maxBatchSize ?? DEFAULT_BATCH_SIZE,
  trialOffered: saved?.trialsessionOffered ?? false,
  trialPaise: saved?.trialSessionPrice ?? 0,
});

/**
 * "Morning" plus "Evening" is the same as "Both", and "Both" alongside either is
 * redundant, so the saved list is always one of: morning, evening, or both.
 */
export const normalizeBatchTimings = (timings: AcademyBatchTiming[]): AcademyBatchTiming[] => {
  const set = new Set(timings);
  if (set.has("both") || (set.has("morning") && set.has("evening"))) return ["both"];
  return (["morning", "evening"] as const).filter((t) => set.has(t));
};

/** Toggles one option, keeping the list in its normal form. */
export const toggleBatchTiming = (
  current: AcademyBatchTiming[],
  timing: AcademyBatchTiming
): AcademyBatchTiming[] => {
  // "Both" is one choice that stands for the other two.
  if (timing === "both") return current.includes("both") ? [] : ["both"];
  // Choosing one of the two while "both" is on narrows it to the other.
  if (current.includes("both")) return [timing === "morning" ? "evening" : "morning"];
  return normalizeBatchTimings(
    current.includes(timing) ? current.filter((t) => t !== timing) : [...current, timing]
  );
};

export type PricingErrors = Partial<
  Record<"rate" | "batchTimings" | "maxBatchSize" | "trialPrice", string>
>;

export const validatePricing = (values: PricingValues): PricingErrors => {
  const errors: PricingErrors = {};

  if (!values.ratePaise || values.ratePaise < MIN_RATE_PAISE) {
    errors.rate = "Rate must be at least ₹1 per hour";
  } else if (values.ratePaise > MAX_RATE_PAISE) {
    errors.rate = "Rate cannot be more than ₹10,00,000 per hour";
  }

  if (values.batchTimings.length === 0) {
    errors.batchTimings = "Choose when your batches run";
  }

  if (
    !Number.isInteger(values.maxBatchSize) ||
    values.maxBatchSize < MIN_BATCH_SIZE ||
    values.maxBatchSize > MAX_BATCH_SIZE
  ) {
    errors.maxBatchSize = `Batch size must be a whole number from ${MIN_BATCH_SIZE} to ${MAX_BATCH_SIZE}`;
  }

  if (values.trialOffered) {
    if (!Number.isFinite(values.trialPaise) || values.trialPaise < 0) {
      errors.trialPrice = "Trial price cannot be negative";
    } else if (values.trialPaise > MAX_RATE_PAISE) {
      errors.trialPrice = "Trial price cannot be more than ₹10,00,000";
    }
  }

  return errors;
};

/**
 * A hint, not an error: a trial that costs more than a normal hour is usually a
 * typo (₹5000 for ₹500), but not impossible, so it does not block saving.
 */
export const trialPriceWarning = (values: PricingValues): string => {
  if (
    values.trialOffered &&
    values.ratePaise >= MIN_RATE_PAISE &&
    values.trialPaise > values.ratePaise
  ) {
    return "This is more than your normal hourly rate. Check the amount.";
  }
  return "";
};

/** The payload the server wants. No trial price unless a trial is offered. */
export const pricingForSave = (values: PricingValues): AcademyPricingPayload => ({
  sessionRatePerHour: values.ratePaise,
  batchTimings: normalizeBatchTimings(values.batchTimings),
  maxBatchSize: values.maxBatchSize,
  trialsessionOffered: values.trialOffered,
  ...(values.trialOffered ? { trialSessionPrice: values.trialPaise } : {}),
});
