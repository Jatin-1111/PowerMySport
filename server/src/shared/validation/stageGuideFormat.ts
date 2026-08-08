// ─── Pathway stage guide — the upload format ────────────────────────────────
//
// ONE schema, three jobs: it validates an uploaded JSON, it types the code that
// reads it, and `z.toJSONSchema()` prints the contract to hand to whatever
// generates the file (see `scripts/printStageGuideSchema.ts`). Change the format
// here and all three move together.
//
// WHY THIS SHAPE. A pathway guide is not free-form prose with a stage heading on
// it — it is the same handful of Indian facts repeated at every rung, and the
// schema says so out loud:
//
//   • a national federation you register with (AITA, AICF, BCCI…), and a STATE
//     association you usually go through first;
//   • age categories the federation actually runs (U-10, U-12, sub-junior…),
//     which is how Indian selection is organised — not by school year;
//   • a ladder of competition tiers, district → state → national → international;
//   • a ranking or rating system, and what a place in it unlocks;
//   • the school route (SGFI and school nationals), which is the cheapest match
//     practice in the country and the one most parents never hear about;
//   • government money — Khelo India, SAI, TOPS, state schemes — which arrives at
//     specific rungs and changes what a family can attempt;
//   • sports-quota seats and the board-exam clash, because in India the academic
//     decision and the sporting one are the same decision.
//
// Anything that is genuinely prose goes in `notes`. Everything else is typed, so
// every sport's guide has the same skeleton and the UI can render it without
// knowing which sport it is. Presentation lives in the client; this is data.
//
// INDEPENDENT OF THE RESOURCE PAGE, on purpose. `SportBasePath` / `SportStatePath`
// feed /resources and the guidance AI. This feeds the pathway page and nothing
// else, so the two surfaces can say different things at different depths without
// one of them having to be a worse copy of the other.

import { z } from "zod";

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const url = z.url("Must be a full URL including https://");

/** Where a rung sits on the map of Indian competition. */
export const COMPETITION_LEVELS = [
  "club",
  "school",
  "district",
  "state",
  "national",
  "international",
] as const;

/** How money arrives. Kept separate because parents chase them differently. */
export const FUNDING_KINDS = [
  "government_scheme",
  "state_scheme",
  "academy_scholarship",
  "university_scholarship",
  "sponsorship",
  "prize_money",
  "quota_seat",
] as const;

const AgeBandSchema = z.object({
  /** Whole years. Used for "is my nine-year-old here?", so keep them honest. */
  fromYears: z.number().int().min(2).max(60).optional(),
  toYears: z.number().int().min(2).max(60).optional(),
  /** What the reader sees — "4 – 8 years", "17+". */
  label: nonEmpty("Age label"),
});

const MoneySchema = z.object({
  /** Annual, in rupees. Numbers so the UI can compare and sort; label is shown. */
  minInr: z.number().int().nonnegative().optional(),
  maxInr: z.number().int().nonnegative().optional(),
  label: nonEmpty("Cost label"),
  note: z.string().trim().optional(),
});

const FundingSchema = z.object({
  name: nonEmpty("Funding name"),
  /** Who runs it — SAI, the state association, the academy, a sponsor. */
  body: nonEmpty("Funding body"),
  kind: z.enum(FUNDING_KINDS),
  eligibility: nonEmpty("Eligibility"),
  benefit: nonEmpty("Benefit"),
  approxAnnualValueInr: z.number().int().nonnegative().optional(),
  howToApply: z.string().trim().optional(),
  officialUrl: url.optional(),
  /** Schemes change. An unverified figure about public money is a liability. */
  verifiedOn: z.iso.date().optional(),
});

const CompetitionTierSchema = z.object({
  name: nonEmpty("Competition name"),
  level: z.enum(COMPETITION_LEVELS),
  organiser: z.string().trim().optional(),
  /** Plain-language entry rule — "AITA membership + U-12 age proof". */
  whoCanEnter: z.string().trim().optional(),
  approxEntryFeeInr: z.number().int().nonnegative().optional(),
  /** "September–October", "through the year". */
  whenHeld: z.string().trim().optional(),
});

/**
 * The two gates, kept apart.
 *
 * "Nothing stops you entering" and "your child can compete here" are different
 * sentences, and collapsing them is what sends a twelve-year-old into a senior
 * draw. Every rung states both, even when one of them is "none".
 */
const GatesSchema = z.object({
  /** Paperwork: membership, age proof, nomination, minimum ranking. */
  administrative: z.array(nonEmpty("Requirement")).default([]),
  /** Standard actually needed to belong there. */
  competitive: z.array(nonEmpty("Requirement")).default([]),
});

const IndiaContextSchema = z.object({
  /** Federation age categories, verbatim — "U-10", "Sub-junior", "Youth". */
  ageCategories: z.array(nonEmpty("Age category")).default([]),
  /** What registering actually involves at this rung. */
  registration: z
    .object({
      body: nonEmpty("Registering body"),
      requirements: z.array(nonEmpty("Requirement")).default([]),
      earliestAge: z.string().trim().optional(),
      officialUrl: url.optional(),
    })
    .optional(),
  competitionTiers: z.array(CompetitionTierSchema).default([]),
  rankingSystem: z
    .object({
      name: nonEmpty("Ranking system name"),
      howPointsWork: z.array(nonEmpty("Point")).default([]),
      whatItUnlocks: z.array(nonEmpty("Unlock")).default([]),
      whatItDoesNotMeasure: z.array(nonEmpty("Caveat")).default([]),
    })
    .optional(),
  /** SGFI / school nationals / inter-school — cheap match practice, underused. */
  schoolRoute: z.string().trim().optional(),
  /** What the STATE association does before the national body gets involved. */
  stateAssociationRole: z.string().trim().optional(),
});

/**
 * The academic side, which in India is not a separate conversation. Board-exam
 * years collide with peak competition years, and a sports-quota seat is a real
 * outcome of a ranking rather than a consolation prize.
 */
const AcademicsSchema = z.object({
  boardExamNote: z.string().trim().optional(),
  quotaRoutes: z.array(nonEmpty("Quota route")).default([]),
  note: z.string().trim().optional(),
});

const StageSchema = z.object({
  /** Stable slug — URLs and "you are here" pins key off it. Never renumber. */
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "key must be kebab-case, e.g. national-ranking"),
  /** 1-based position. Must run 1..n with no gaps (checked below). */
  number: z.number().int().min(1),
  title: nonEmpty("Stage title"),
  /** Two lines in the stage list. */
  shortDescription: nonEmpty("Short description"),
  /** One line under the stage heading. Must NOT repeat shortDescription. */
  summary: nonEmpty("Summary"),
  goal: nonEmpty("Goal"),

  age: AgeBandSchema.optional(),
  duration: z.string().trim().optional(),
  cost: MoneySchema.optional(),
  /** Where the child stands on the sport's own scale — "UTR 6–9", "AICF 1200". */
  standard: z.string().trim().optional(),

  india: IndiaContextSchema.optional(),
  funding: z.array(FundingSchema).default([]),
  gates: GatesSchema.optional(),

  movingUp: z
    .object({
      /** `key` of the next stage, when it is a single obvious one. */
      toStageKey: z.string().trim().optional(),
      criteria: z.array(nonEmpty("Criterion")).default([]),
      typicalDuration: z.string().trim().optional(),
      /** The honest warning where a rung is commonly attempted too early. */
      warning: z.string().trim().optional(),
    })
    .optional(),

  parentGuidance: z
    .object({
      dos: z.array(nonEmpty("Item")).default([]),
      avoid: z.array(nonEmpty("Item")).default([]),
      questionsForCoach: z.array(nonEmpty("Question")).default([]),
    })
    .optional(),

  readinessChecklist: z.array(nonEmpty("Checklist item")).default([]),
  /** What reaching this rung is worth even if the child goes no further. */
  outcomes: z.array(nonEmpty("Outcome")).default([]),
  risks: z
    .object({
      commonInjuries: z.array(nonEmpty("Injury")).default([]),
      burnoutSigns: z.array(nonEmpty("Sign")).default([]),
    })
    .optional(),
  academics: AcademicsSchema.optional(),
  /** Escape hatch for anything genuinely prose. Rendered as paragraphs. */
  notes: z.array(nonEmpty("Note")).default([]),
});

export const StageGuideSchema = z
  .object({
    /** Bump only on a breaking change; the reader refuses versions it can't read. */
    formatVersion: z.literal(1),
    sport: z.object({
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "sport.slug must be kebab-case"),
      name: nonEmpty("Sport name"),
    }),
    /**
     * Omit for the national guide. Set it only when the STAGES themselves differ
     * by state — local academies and fees belong in SportStatePath, not here.
     */
    state: z.string().trim().optional(),
    governingBody: z
      .object({
        name: nonEmpty("Governing body name"),
        acronym: z.string().trim().optional(),
        website: url.optional(),
      })
      .optional(),
    /** The sport's own yardstick — UTR, AICF/FIDE rating, BWF points. */
    progressMetric: z
      .object({
        label: nonEmpty("Metric label"),
        description: z.string().trim().optional(),
      })
      .optional(),
    intro: z.string().trim().optional(),
    stages: z.array(StageSchema).min(2, "A guide needs at least two stages"),
    /** Where this came from. Shown to the reader; required, not decorative. */
    sources: z
      .array(
        z.object({
          label: nonEmpty("Source label"),
          url: url.optional(),
          publishedOn: z.iso.date().optional(),
        }),
      )
      .min(1, "At least one source is required"),
    verifiedOn: z.iso.date().optional(),
  })
  .superRefine((guide, ctx) => {
    // Stage numbers must be 1..n, in order, no gaps — the reader renders
    // "Stage 3 of 9" and drives Previous/Next straight off this.
    guide.stages.forEach((stage, i) => {
      if (stage.number !== i + 1) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", i, "number"],
          message: `Expected number ${i + 1}, got ${stage.number}. Stages must be listed in order with no gaps.`,
        });
      }
    });

    const keys = new Set<string>();
    guide.stages.forEach((stage, i) => {
      if (keys.has(stage.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", i, "key"],
          message: `Duplicate stage key "${stage.key}".`,
        });
      }
      keys.add(stage.key);
    });

    // A movingUp pointer into a stage that doesn't exist would render a dead link.
    guide.stages.forEach((stage, i) => {
      const target = stage.movingUp?.toStageKey;
      if (target && !guide.stages.some((s) => s.key === target)) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", i, "movingUp", "toStageKey"],
          message: `No stage has key "${target}".`,
        });
      }
    });

    // The panel subtitle sitting directly under the same sentence in the stage
    // list is the single most common authoring slip, and it wastes the one line
    // that could add something.
    guide.stages.forEach((stage, i) => {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (norm(stage.summary) === norm(stage.shortDescription)) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", i, "summary"],
          message:
            "summary repeats shortDescription word for word — say something the stage list doesn't already say.",
        });
      }
    });
  });

export type StageGuideInput = z.input<typeof StageGuideSchema>;
export type StageGuide = z.output<typeof StageGuideSchema>;
export type StageGuideStage = StageGuide["stages"][number];

/** Flatten Zod issues into `stages[2].funding[0].benefit: message` lines. */
export function formatStageGuideIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path
      .map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`))
      .join("")
      .replace(/^\./, "");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
