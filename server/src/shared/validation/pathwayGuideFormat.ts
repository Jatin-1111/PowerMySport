import { z } from "zod";

// ─── Pathway guide format ────────────────────────────────────────────────────
//
// One schema, three jobs: it validates what the admin CMS sends, it types every
// reader on the server, and `PathwayStageInput` is what the seed script writes.
// There is deliberately no second hand-written copy of this shape anywhere.
//
// The structure is the blueprint's five buckets and nothing else. Every stage
// answers the same five questions in the same order, because the whole point of
// the format is that a parent learns the shape once and it never moves:
//
//   1. Overview          — where am I and what does this stage mean?
//   2. Parent's Questions — what am I likely to be worried or confused about?
//   3. What to Look For   — what should I observe in my child, coach, environment?
//   4. Decisions          — what choices may I need to make?
//   5. Next Step          — what should I actually do now?
//
// Buckets 2, 3 and 4 all carry an optional `detail`/`answer`. That optionality is
// load-bearing: the blueprint ships every stage's headlines but only fills in the
// prose for Stage 1, and the CMS has to be able to save that honestly rather than
// forcing an author to invent copy to get past validation.

/** Bumped only when a stored guide would need rewriting to be read correctly. */
export const PATHWAY_FORMAT_VERSION = 1;

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** kebab-case, stable across renames — it is the anchor a link can point at. */
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case (e.g. discover-tennis)");

// ─── Bucket 2: Parent's Questions ────────────────────────────────────────────

export const PathwayQuestionSchema = z.object({
  question: trimmed(220),
  /** The written answer. Absent = the question is listed but not yet answered. */
  answer: z.string().trim().max(2000).optional(),
});

// ─── Buckets 3 & 4: What to Look For / Decisions ─────────────────────────────
//
// Same shape on purpose. In the blueprint both are a headline the parent scans
// and an optional paragraph they open — modelling them differently would buy
// nothing and cost the CMS a second editor component.

export const PathwayPointSchema = z.object({
  title: trimmed(220),
  detail: z.string().trim().max(2000).optional(),
});

// ─── Bucket 5: Next Step ─────────────────────────────────────────────────────
//
// Two flavours share one shape. Early stages are situational ("Not started →
// find 2–3 trial options"); later stages are ordered ("Step 1 → …"). `when` is
// the left column either way, so the renderer needs no branch.

export const PathwayNextStepSchema = z.object({
  when: trimmed(120),
  action: trimmed(400),
});

// ─── Calls to action ─────────────────────────────────────────────────────────

export const PathwayActionSchema = z.object({
  label: trimmed(80),
  /** Site-relative path, or absolute http(s). Absent renders as plain text. */
  href: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v.startsWith("/") || /^https?:\/\//.test(v),
      "must start with / or http(s)://",
    )
    .optional(),
});

// ─── A stage ─────────────────────────────────────────────────────────────────

export const PathwayStageSchema = z.object({
  key: slug,
  /** Display name, e.g. "Discover Tennis". Rendered upper-case by the page. */
  name: trimmed(80),
  /** Free text, e.g. "~5–7" or "18+" — ranges here are fuzzy by design. */
  ageRange: trimmed(40),
  /** The one question this stage exists to answer. Heads the stage. */
  coreQuestion: trimmed(200),
  /** Bucket 1. */
  overview: trimmed(1500),
  /** Bucket 2. */
  questions: z.array(PathwayQuestionSchema).max(20).default([]),
  /** Bucket 3. */
  signals: z.array(PathwayPointSchema).max(20).default([]),
  /** Bucket 4. */
  decisions: z.array(PathwayPointSchema).max(20).default([]),
  /** Bucket 5 — the sentence above the list, e.g. "Pick the line that fits you today." */
  nextStepLead: z.string().trim().max(400).optional(),
  nextSteps: z.array(PathwayNextStepSchema).max(20).default([]),
  /** The one button this stage pushes. */
  primaryAction: PathwayActionSchema.optional(),
  /** "Get help" chips — Find academy, Book expert, Find tournament… */
  helpLinks: z.array(PathwayActionSchema).max(12).default([]),
});

// ─── A guide ─────────────────────────────────────────────────────────────────

export const PathwayGuideSchema = z.object({
  formatVersion: z.literal(PATHWAY_FORMAT_VERSION).default(PATHWAY_FORMAT_VERSION),
  sport: z.object({ slug, name: trimmed(60) }),
  /** Hero copy. Small enough to live with the guide rather than in a second CMS. */
  intro: z
    .object({
      eyebrow: z.string().trim().max(80).optional(),
      headline: z.string().trim().max(160).optional(),
      description: z.string().trim().max(800).optional(),
    })
    .default({}),
  /** "Tennis is an individual Olympic sport…" — one entry per paragraph. */
  sportIntro: z.array(trimmed(800)).max(8).default([]),
  stages: z.array(PathwayStageSchema).min(1).max(12),
  /** Free text, e.g. "Reviewed with AITA coaches, Aug 2026". */
  reviewedOn: z.string().trim().max(120).optional(),
});

export type PathwayQuestion = z.infer<typeof PathwayQuestionSchema>;
export type PathwayPoint = z.infer<typeof PathwayPointSchema>;
export type PathwayNextStep = z.infer<typeof PathwayNextStepSchema>;
export type PathwayAction = z.infer<typeof PathwayActionSchema>;
export type PathwayStage = z.infer<typeof PathwayStageSchema>;
export type PathwayGuide = z.infer<typeof PathwayGuideSchema>;
/** What a caller passes in, before defaults are applied. */
export type PathwayStageInput = z.input<typeof PathwayStageSchema>;
export type PathwayGuideInput = z.input<typeof PathwayGuideSchema>;

// ─── Cross-field rules ───────────────────────────────────────────────────────
//
// Zod checks each field; these check the guide as a whole. Both failures below
// are ones a human editing stages by hand actually makes.

/** Stage keys must be unique — they are how the CMS addresses a single stage. */
export function findDuplicateStageKeys(stages: Array<{ key: string }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const stage of stages) {
    if (seen.has(stage.key)) duplicates.add(stage.key);
    seen.add(stage.key);
  }
  return [...duplicates];
}

export type PathwayGuideParse =
  | { ok: true; guide: PathwayGuide }
  | { ok: false; errors: string[] };

/**
 * Parse and cross-check in one call.
 *
 * Errors come back pathed (`stages[3].questions[0].question: …`) because the
 * person reading them is looking at a form with forty fields on it, and
 * "invalid payload" would send them hunting.
 */
export function parsePathwayGuide(input: unknown): PathwayGuideParse {
  const parsed = PathwayGuideSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: formatPathwayIssues(parsed.error) };
  }

  const duplicates = findDuplicateStageKeys(parsed.data.stages);
  if (duplicates.length > 0) {
    return {
      ok: false,
      errors: duplicates.map(
        (key) => `stages: two stages share the key "${key}" — keys must be unique.`,
      ),
    };
  }

  return { ok: true, guide: parsed.data };
}

/** Turn a ZodError into one readable `path: message` line per problem. */
export function formatPathwayIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path
      .map((segment) => (typeof segment === "number" ? `[${segment}]` : segment))
      .join(".")
      .replace(/\.\[/g, "[");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/** Validate a single stage on its own — what the per-stage CMS endpoints use. */
export function parsePathwayStage(
  input: unknown,
): { ok: true; stage: PathwayStage } | { ok: false; errors: string[] } {
  const parsed = PathwayStageSchema.safeParse(input);
  return parsed.success
    ? { ok: true, stage: parsed.data }
    : { ok: false, errors: formatPathwayIssues(parsed.error) };
}
