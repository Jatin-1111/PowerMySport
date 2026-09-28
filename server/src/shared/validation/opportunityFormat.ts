import { z } from "zod";

import { formatPathwayIssues } from "./pathwayGuideFormat";

// ─── Opportunity format (admissions and scholarships) ───────────────────────
//
// One schema, three jobs, the same as the pathway format: it validates what the
// admin CMS sends, it types every reader, and it is what the draft-content
// script writes. There is no second hand-written copy of this shape.
//
// Admissions and scholarships are one model because they are one kind of
// record: someone (a university, a ministry, a federation) offers something to
// a young athlete who meets a bar, in a window, and publishes the rules in a
// document we can cite. What differs is only which page a parent finds it on.
//
// ── Why so much of it is about provenance ──
// This data changes every year, by PDF circular, and most of it is published
// on sites that are hard to read reliably. A figure a parent acts on has to say
// where it came from and when someone last checked it, so `sources` and
// `lastVerifiedOn` are required before anything can be published, and the
// reader shows both.

export const OPPORTUNITY_TRACKS = ["admission", "scholarship"] as const;
export type OpportunityTrack = (typeof OPPORTUNITY_TRACKS)[number];

/** The page sections, per track. Order here is the order they are shown in. */
export const OPPORTUNITY_CATEGORIES = {
  admission: ["college", "school", "exam-concession", "academy", "study-abroad"],
  scholarship: ["government", "federation", "international", "company", "university"],
} as const satisfies Record<OpportunityTrack, readonly string[]>;

const ALL_CATEGORIES = [
  ...OPPORTUNITY_CATEGORIES.admission,
  ...OPPORTUNITY_CATEGORIES.scholarship,
] as const;
export type OpportunityCategory = (typeof ALL_CATEGORIES)[number];

export const OWNER_TYPES = [
  "central-government",
  "state-government",
  "federation",
  "international-body",
  "university",
  "school-board",
  "public-sector-company",
  "company",
  "foundation",
] as const;

/**
 * How someone actually gets it. The distinction the page must never blur is
 * `apply` against `scouted`/`nominated`: a Khelo India scholarship has no
 * application form, and a page that implies one sends a parent looking for a
 * link that does not exist.
 */
export const SELECTION_MODES = ["apply", "trials", "nominated", "scouted", "recruitment"] as const;

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case (e.g. du-sports-quota)");

/** Calendar dates are stored as "YYYY-MM-DD" strings: no time zone to get wrong. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "must be a date like 2026-07-30");

const sportSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a sport slug like table-tennis");

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "must start with http:// or https://");

export const OpportunityOwnerSchema = z.object({
  name: trimmed(160),
  type: z.enum(OWNER_TYPES),
});

export const OpportunityAmountSchema = z.object({
  value: z.number().positive().max(1_000_000_000),
  currency: z.enum(["INR", "USD"]),
  period: z.enum(["one-time", "month", "year", "total"]),
  note: optionalText(200),
});

export const OpportunityBenefitSchema = z.object({
  /** What the athlete gets, in a line: "An extra seat, outside the general merit list". */
  summary: trimmed(300),
  amount: OpportunityAmountSchema.optional(),
});

export const OpportunityEligibilitySchema = z.object({
  ageMin: z.number().int().min(3).max(40).optional(),
  ageMax: z.number().int().min(3).max(40).optional(),
  /** The rule the ages are measured by, e.g. "Age on 1 January of the admission year". */
  ageNote: optionalText(300),
  gender: z.enum(["any", "female", "male"]).default("any"),
  /** The sporting bar, in plain words: "A national-level medal in the last four years". */
  level: optionalText(600),
  /** CUET score, JEE Advanced rank, class to be entering. */
  academic: optionalText(400),
  income: optionalText(300),
});

export const OpportunityCycleSchema = z.object({
  /** "2026-27". The year these rules are for; they change every cycle. */
  label: optionalText(40),
  opensOn: isoDate.optional(),
  closesOn: isoDate.optional(),
  keyDates: z
    .array(z.object({ label: trimmed(120), date: isoDate }))
    .max(10)
    .default([]),
});

export const OpportunitySourceSchema = z.object({
  label: trimmed(160),
  url: httpUrl,
  /** When the source itself was published or last updated, if it says. */
  publishedOn: isoDate.optional(),
});

const baseShape = {
  slug,
  track: z.enum(OPPORTUNITY_TRACKS),
  category: z.enum(ALL_CATEGORIES),
  title: trimmed(160),
  /** What this is and who it is for, in two or three sentences. */
  summary: trimmed(700),
  owner: OpportunityOwnerSchema,
  /** Empty with `allSports: true` for the many schemes that cover every sport. */
  sports: z.array(sportSlug).max(20).default([]),
  allSports: z.boolean().default(false),
  geography: z.object({
    scope: z.enum(["india", "state", "international", "abroad"]),
    state: optionalText(60),
  }),
  eligibility: OpportunityEligibilitySchema.default({ gender: "any" }),
  selection: z.enum(SELECTION_MODES),
  benefit: OpportunityBenefitSchema,
  cycle: OpportunityCycleSchema.default({ keyDates: [] }),
  /** What a parent does, in order. For `scouted`, how a player gets noticed. */
  steps: z.array(trimmed(500)).max(12).default([]),
  keyFacts: z.array(trimmed(400)).max(12).default([]),
  applyUrl: httpUrl.optional(),
  sources: z.array(OpportunitySourceSchema).min(1).max(8),
  /**
   * Pages where the next cycle's document will appear, e.g. DU's admissions
   * page. Checked weekly with the sources (opportunityWatch.ts); never shown
   * to parents.
   */
  watchUrls: z.array(httpUrl).max(6).default([]),
  lastVerifiedOn: isoDate,
  /** What could not be confirmed, said plainly on the page. */
  verificationNote: optionalText(500),
};

/** Cross-field rules that no single field can check. */
const crossCheck = (
  value: {
    track?: OpportunityTrack | undefined;
    category?: OpportunityCategory | undefined;
    sports?: string[] | undefined;
    allSports?: boolean | undefined;
    geography?: { scope: string; state?: string | undefined } | undefined;
    eligibility?: { ageMin?: number | undefined; ageMax?: number | undefined } | undefined;
    cycle?: { opensOn?: string | undefined; closesOn?: string | undefined } | undefined;
  },
  ctx: z.RefinementCtx
) => {
  if (value.track && value.category) {
    const allowed = OPPORTUNITY_CATEGORIES[value.track] as readonly string[];
    if (!allowed.includes(value.category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: `"${value.category}" is not a ${value.track} category (${allowed.join(", ")}).`,
      });
    }
  }
  if (value.allSports && (value.sports?.length ?? 0) > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sports"],
      message: "Leave the sport list empty when it covers all sports.",
    });
  }
  if (value.geography?.scope === "state" && !value.geography.state?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["geography", "state"],
      message: "Name the state for a state scheme.",
    });
  }
  const { ageMin, ageMax } = value.eligibility ?? {};
  if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eligibility", "ageMax"],
      message: "The upper age is below the lower one.",
    });
  }
  const { opensOn, closesOn } = value.cycle ?? {};
  if (opensOn && closesOn && opensOn > closesOn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cycle", "closesOn"],
      message: "The window closes before it opens.",
    });
  }
};

/** A publishable record: everything a parent will read is present and sourced. */
export const OpportunitySchema = z
  .object(baseShape)
  .superRefine((value, ctx) => crossCheck(value, ctx))
  .refine((value) => value.allSports || value.sports.length > 0, {
    path: ["sports"],
    message: "Pick at least one sport, or mark it as covering all sports.",
  });

/**
 * A draft: only what identifies it is required, so an editor can save a record
 * they are halfway through checking. Publishing re-validates the whole thing
 * with `OpportunitySchema`.
 */
export const OpportunityDraftSchema = z
  .object({
    ...Object.fromEntries(
      Object.entries(baseShape).map(([key, schema]) => [key, (schema as z.ZodTypeAny).optional()])
    ),
    slug,
    track: baseShape.track,
    category: baseShape.category,
    title: baseShape.title,
  })
  .superRefine((value, ctx) => crossCheck(value as Parameters<typeof crossCheck>[0], ctx));

export type OpportunityInput = z.infer<typeof OpportunitySchema>;

export type OpportunityParse<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function parseOpportunity(input: unknown): OpportunityParse<OpportunityInput> {
  const parsed = OpportunitySchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, errors: formatPathwayIssues(parsed.error) };
}

export function parseOpportunityDraft(input: unknown): OpportunityParse<Record<string, unknown>> {
  const parsed = OpportunityDraftSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data as Record<string, unknown> }
    : { ok: false, errors: formatPathwayIssues(parsed.error) };
}

// ─── Derived state, computed on read ─────────────────────────────────────────
//
// Nothing here is stored, so there is no job to forget to run: an entry whose
// window closed yesterday reads as closed today.

export type CycleState = "open" | "upcoming" | "closed" | "rolling";

/** Where this cycle's window stands on `today` ("YYYY-MM-DD"). */
export function cycleStateOf(
  cycle: { opensOn?: string | null; closesOn?: string | null } | undefined,
  today: string
): CycleState {
  const opensOn = cycle?.opensOn ?? undefined;
  const closesOn = cycle?.closesOn ?? undefined;
  if (closesOn && today > closesOn) return "closed";
  if (opensOn && today < opensOn) return "upcoming";
  if (opensOn || closesOn) return "open";
  return "rolling";
}

/** A year without a re-check is long enough for any of these rules to have changed. */
export const STALE_AFTER_DAYS = 365;

export function isStale(lastVerifiedOn: string | null | undefined, today: string): boolean {
  if (!lastVerifiedOn) return true;
  const ageMs = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastVerifiedOn}T00:00:00Z`);
  return ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/** Today in India, as the date string the rules above compare against. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
