// ─── Uploaded guide → the stage reader ──────────────────────────────────────
//
// The upload format is semantic: it says "these are the federation's age
// categories", "this is government money", "this is the paperwork gate and this
// is the competitive one". This file is the only place that decides what any of
// that LOOKS like, which is what lets an author add a sport without touching a
// component, and lets us restyle every sport by editing one file.
//
// The mapping is deliberately fixed rather than author-controlled:
//
//   Overview      what this rung is, the numbers, what reaching it is worth
//   Key Topics    how India organises it — registration, categories, tiers, ranking
//   What to Expect the two gates, what moving up takes, the honest warning
//   Tips for Parents  do / avoid / what to ask a coach
//   Resources     money, checklist, academics
//
// A tab with nothing behind it is dropped rather than rendered empty, so a thin
// guide reads as short instead of broken.

import {
  SUPPORTED_STAGE_GUIDE_FORMAT,
  type ApiStage,
  type ApiStageGuide,
} from "./apiFormat";
import type { GuideStage, StageBlock, StageGuide, StageTab } from "./types";

/** Accepts `cond && "text"` so callers can inline optional parts. */
const clean = (values: (string | undefined | false | null)[]): string[] =>
  values.map((v) => (v ? v.trim() : "")).filter((v) => v.length > 0);

function list(
  title: string,
  items: (string | undefined)[] | undefined,
  tone?: "check" | "cross" | "bullet",
): StageBlock | null {
  const kept = clean(items ?? []);
  if (kept.length === 0) return null;
  return tone
    ? { kind: "list", title, items: kept, tone }
    : { kind: "list", title, items: kept };
}

function pairs(
  title: string,
  rows: { label: string; value: string | undefined }[],
): StageBlock | null {
  const kept = rows
    .map((r) => ({ label: r.label, value: r.value?.trim() ?? "" }))
    .filter((r) => r.value.length > 0);
  if (kept.length === 0) return null;
  return { kind: "pairs", title, rows: kept };
}

function callout(
  tone: "goal" | "warn" | "money",
  title: string,
  text: string | undefined,
): StageBlock | null {
  const t = text?.trim();
  return t ? { kind: "callout", tone, title, text: t } : null;
}

function tab(id: StageTab["id"], blocks: (StageBlock | null)[]): StageTab | null {
  const kept = blocks.filter((b): b is StageBlock => b !== null);
  return kept.length > 0 ? { id, blocks: kept } : null;
}

/** "AITA Talent Series (state) · through the season — AITA-registered players". */
function describeTier(tier: NonNullable<ApiStage["india"]>["competitionTiers"]) {
  return (tier ?? []).map((t) => ({
    label: t.name,
    value: clean([
      t.level,
      t.organiser && `run by ${t.organiser}`,
      t.whenHeld,
      t.whoCanEnter,
      t.approxEntryFeeInr !== undefined &&
        `entry about ₹${t.approxEntryFeeInr.toLocaleString("en-IN")}`,
    ]).join(" · "),
  }));
}

function stageFrom(stage: ApiStage, metricLabel?: string): GuideStage {
  const india = stage.india;
  const funding = stage.funding ?? [];

  const tabs = [
    tab("overview", [
      pairs("The numbers here", [
        { label: "Typical age", value: stage.age?.label },
        {
          label: metricLabel ? `Standard (${metricLabel})` : "Standard",
          value: stage.standard,
        },
        { label: "Cost a year", value: stage.cost?.label },
        { label: "Time here", value: stage.duration },
      ]),
      callout("money", "About these costs", stage.cost?.note),
      list("What reaching this is worth", stage.outcomes),
      ...clean(stage.notes ?? []).map(
        (text): StageBlock => ({ kind: "prose", text }),
      ),
    ]),

    tab("topics", [
      list("Age categories at this level", india?.ageCategories),
      india?.registration
        ? pairs(`Registering with ${india.registration.body}`, [
            { label: "You need", value: india.registration.requirements?.join(" · ") },
            { label: "Earliest age", value: india.registration.earliestAge },
          ])
        : null,
      callout(
        "goal",
        "Your state association's part in it",
        india?.stateAssociationRole,
      ),
      (india?.competitionTiers?.length ?? 0) > 0
        ? {
            kind: "pairs" as const,
            title: "Where you compete",
            rows: describeTier(india?.competitionTiers),
          }
        : null,
      india?.rankingSystem
        ? pairs(india.rankingSystem.name, [
            { label: "How points work", value: india.rankingSystem.howPointsWork?.join(" · ") },
          ])
        : null,
      list("What a ranking gets you", india?.rankingSystem?.whatItUnlocks, "check"),
      list(
        "What it does not measure",
        india?.rankingSystem?.whatItDoesNotMeasure,
        "cross",
      ),
      callout("goal", "The school route", india?.schoolRoute),
    ]),

    tab("expect", [
      // The two gates, kept apart — the whole reason the format separates them.
      list("What the rules require", stage.gates?.administrative, "check"),
      list("What your child actually needs", stage.gates?.competitive, "check"),
      list("To move up", stage.movingUp?.criteria, "check"),
      pairs("How long it usually takes", [
        { label: "Typically", value: stage.movingUp?.typicalDuration },
      ]),
      callout("warn", "Before you attempt this early", stage.movingUp?.warning),
      list("Signs of burnout to watch", stage.risks?.burnoutSigns, "cross"),
      list("Common injuries here", stage.risks?.commonInjuries),
    ]),

    tab("tips", [
      list("What helps", stage.parentGuidance?.dos, "check"),
      list("What to avoid", stage.parentGuidance?.avoid, "cross"),
      list("Ask the coach", stage.parentGuidance?.questionsForCoach),
    ]),

    tab("resources", [
      funding.length > 0
        ? {
            kind: "pairs" as const,
            title: "Money available at this stage",
            rows: funding.map((f) => ({
              label: f.name,
              value: clean([
                f.benefit,
                f.approxAnnualValueInr !== undefined &&
                  `about ₹${f.approxAnnualValueInr.toLocaleString("en-IN")} a year`,
                `via ${f.body}`,
                f.eligibility && `Eligibility: ${f.eligibility}`,
                f.howToApply && `Apply: ${f.howToApply}`,
              ]).join(" · "),
            })),
          }
        : null,
      list("Before you move on, check", stage.readinessChecklist, "check"),
      callout("warn", "Board exams and this stage", stage.academics?.boardExamNote),
      list("Academic routes this opens", stage.academics?.quotaRoutes, "check"),
      callout("goal", "Academics alongside", stage.academics?.note),
    ]),
  ].filter((t): t is StageTab => t !== null);

  return {
    id: stage.key,
    title: stage.title,
    ageLabel: stage.age?.label,
    ageRange: stage.age?.label,
    listNote: stage.shortDescription,
    subtitle: stage.summary,
    goal: stage.goal,
    // A contents list for the stage, built from the sections it actually has.
    atAGlance: clean([
      stage.age?.label && `Typical age ${stage.age.label}`,
      stage.cost?.label,
      stage.standard,
      india?.registration && `Registering with ${india.registration.body}`,
      india?.rankingSystem?.name,
      funding[0]?.name && `Funding: ${funding[0].name}`,
    ]).slice(0, 6),
    tabs,
  };
}

/**
 * Convert an uploaded guide, or return undefined when it can't be rendered —
 * an unreadable payload must fall back to the derived stages rather than
 * blanking the page.
 */
export function stageGuideFromApi(
  api: ApiStageGuide | undefined | null,
): StageGuide | undefined {
  if (!api || api.formatVersion !== SUPPORTED_STAGE_GUIDE_FORMAT) return undefined;
  if (!Array.isArray(api.stages) || api.stages.length === 0) return undefined;

  const metricLabel = api.progressMetric?.label;
  const stages = [...api.stages]
    .sort((a, b) => a.number - b.number)
    .map((s) => stageFrom(s, metricLabel));

  return {
    sport: api.sport?.name ?? "",
    resourceSlug: api.sport?.slug,
    ...(api.stateGroups?.groups?.length
      ? { stateGroups: api.stateGroups }
      : {}),
    stages,
  };
}
