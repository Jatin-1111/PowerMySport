import fs = require("fs");
import path = require("path");
import {
  annualEntryCap,
  buildShortlist,
  type AcceptanceSample,
  type PlannerEdition,
} from "@powermysport/shared-types";
import type { PlannerOverview } from "../../client/services/PlannerService";
import { reachFor } from "../../client/services/plannerReach";
import { baselineRecommend } from "../../client/services/plannerRecommendations/baseline";
import { buildContext } from "../../client/services/plannerRecommendations/candidates";
import type {
  PlannerModelOptions,
  PlannerModelUsage,
} from "../../client/services/plannerRecommendations/gemini";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
} from "../../client/services/plannerRecommendations/prompt";
import type {
  RecommendationContext,
  RecommendationResult,
} from "../../client/services/plannerRecommendations/types";
import {
  hasWordableItems,
  inspectModelOutput,
  type ValidationStats,
} from "../../client/services/plannerRecommendations/validate";
import type { EvalChild } from "./children";
import { scoreResult, type Score } from "./score";

/**
 * Runs the real recommender, with no database and no network unless a model is asked for.
 *
 * ── What is real and what is not ────────────────────────────────────────────
 * Real: the calendar (frozen from production on a known day), the entry rules
 * (`buildShortlist`, the same function the page and the server use), `buildContext`, the
 * rules-only recommender, the prompt, the validator. Synthetic: the children, who exist
 * only here (see `children.ts`).
 *
 * The model path repeats what `RecommendationService.generate` does around the model
 * call (prompt, validate, fall back to the rules) but without Redis, the daily allowance
 * or the cache, none of which affect the quality of an answer. That keeps a run
 * repeatable and keeps it from spending a real parent's allowance.
 */

const FIXTURES = path.resolve(__dirname, "../../../src/evals/plannerRecommendations/fixtures");

export interface FrozenCalendar {
  frozenOn: string;
  editions: PlannerEdition[];
}

export const loadCalendar = (): FrozenCalendar =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, "calendar.json"), "utf8")) as FrozenCalendar;

/**
 * Who got into finished events, as numbers only (no names), read from AITA's public
 * acceptance lists on the date it was captured. Refresh it with the capture script:
 * `node dist/scripts/ingestAitaAcceptance.js --no-db --out ...`.
 */
export interface AcceptanceFixture {
  capturedOn: string;
  records: AcceptanceSample[];
}

export const loadAcceptance = (): AcceptanceFixture =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, "acceptance.json"), "utf8")) as AcceptanceFixture;

/** Ten in the morning UTC on the day the calendar was frozen. */
export const nowFor = (calendar: FrozenCalendar): Date =>
  new Date(`${calendar.frozenOn}T10:00:00.000Z`);

export async function overviewFor(
  child: EvalChild,
  calendar: FrozenCalendar
): Promise<PlannerOverview> {
  const gender = child.gender ?? "Boys";
  const history = loadAcceptance().records;
  const shortlist = buildShortlist(calendar.editions, {
    bracket: child.ageGroup,
    rank: child.rank,
  });

  const planned = (child.plannedPositions ?? [])
    .map((position) => shortlist.ownGroup[position]?.edition)
    .filter((edition): edition is PlannerEdition => Boolean(edition?.slug))
    .map((edition) => ({
      editionSlug: edition.slug!,
      name: edition.name,
      startDate: edition.startDate,
      status: "shortlisted" as const,
      addedAt: calendar.frozenOn,
    }));

  const year = calendar.frozenOn.slice(0, 4);
  const played = Array.from({ length: child.playedEarlier ?? 0 }, (_, index) => ({
    editionSlug: `earlier-${index}`,
    name: `Earlier event ${index + 1}`,
    startDate: `${year}-02-${String((index % 27) + 1).padStart(2, "0")}T00:00:00.000Z`,
    status: "played" as const,
    addedAt: `${year}-01-01`,
  }));

  const reach = await reachFor({
    entries: shortlist.ownGroup,
    ageGroup: child.ageGroup,
    gender,
    rank: child.rank,
    load: async (ladder, ageGroup, sex) =>
      history.filter(
        (sample) =>
          sample.ladder === ladder && sample.ageGroup === ageGroup && sample.gender === sex
      ),
  });

  return {
    dependentId: child.id,
    dependentName: "Evaluation child",
    sportSlug: "tennis",
    linkState: "ready",
    standing: {
      category: gender,
      subcategory: child.ageGroup,
      rank: child.rank,
      totalPoints: null,
      alsoRanked: [],
      state: child.state,
      asOnDate: new Date(`${calendar.frozenOn}T00:00:00.000Z`) as unknown as string,
    },
    annualEntryCap: annualEntryCap(child.ageGroup),
    shortlist,
    reach,
    plan: {
      dependentId: child.id,
      sportSlug: "tennis",
      entries: [...played, ...planned],
      preferences: {
        goal: child.goal,
        blockedRanges: child.blockedRanges ?? [],
        budget: null,
        includeOlderGroup: false,
      },
      dismissed: [],
    },
    editionsConsidered: calendar.editions.length,
  } as unknown as PlannerOverview;
}

export const contextFor = async (
  child: EvalChild,
  calendar: FrozenCalendar
): Promise<RecommendationContext> => {
  const context = buildContext(await overviewFor(child, calendar), nowFor(calendar));
  if (!context) throw new Error(`Profile ${child.id} produced no recommendation context`);
  return context;
};

export interface RunRecord {
  childId: string;
  system: "rules" | "model";
  /** Which answer was scored: the model's, or the rules when the model failed. */
  source: RecommendationResult["source"];
  fallbackReason: string | null;
  result: RecommendationResult;
  score: Score;
  candidates: number;
  /** Model runs only. */
  model?: {
    ms: number;
    usage: PlannerModelUsage | null;
    promptChars: number;
    stats: ValidationStats | null;
    error: string | null;
  };
}

export async function runRules(child: EvalChild, calendar: FrozenCalendar): Promise<RunRecord> {
  const context = await contextFor(child, calendar);
  const result = baselineRecommend(context, nowFor(calendar));
  return {
    childId: child.id,
    system: "rules",
    source: result.source,
    fallbackReason: null,
    result,
    score: scoreResult(context, result),
    candidates: context.candidates.length,
  };
}

export type ModelCaller = (
  systemPrompt: string,
  userPrompt: string,
  options?: PlannerModelOptions
) => Promise<{ value: unknown; usage: PlannerModelUsage }>;

export async function runModel(
  child: EvalChild,
  calendar: FrozenCalendar,
  call: ModelCaller
): Promise<RunRecord> {
  const context = await contextFor(child, calendar);
  const now = nowFor(calendar);
  const userPrompt = buildUserPrompt(context, now);

  // Nothing for a model to say: the service answers from the rules without a model call.
  const built = baselineRecommend(context, now);
  if (!hasWordableItems(built.items, context)) {
    const result = built;
    return {
      childId: child.id,
      system: "model",
      source: "rules",
      fallbackReason: null,
      result,
      score: scoreResult(context, result),
      candidates: 0,
      model: { ms: 0, usage: null, promptChars: userPrompt.length, stats: null, error: null },
    };
  }

  const startedAt = Date.now();
  let usage: PlannerModelUsage | null = null;
  let stats: ValidationStats | null = null;
  let error: string | null = null;
  let result: RecommendationResult | null = null;
  let fallback: "ai-unavailable" | "invalid-output" = "ai-unavailable";

  try {
    const answer = await call(SYSTEM_PROMPT, userPrompt, {
      slugs: baselineRecommend(context, now).items.map((item) => item.slug),
    });
    usage = answer.usage;
    const inspected = inspectModelOutput(answer.value, context, now);
    stats = inspected.stats;
    result = inspected.result;
    if (!result) fallback = "invalid-output";
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const ms = Date.now() - startedAt;

  const answer = result ?? baselineRecommend(context, now, fallback);
  return {
    childId: child.id,
    system: "model",
    source: answer.source,
    fallbackReason: result ? null : fallback,
    result: answer,
    score: scoreResult(context, answer),
    candidates: context.candidates.length,
    model: { ms, usage, promptChars: userPrompt.length, stats, error },
  };
}

/**
 * An answer given earlier, scored again by today's rules and today's evidence. This is how
 * "before" and "after" are compared fairly: the before-answer is judged by the standard the
 * after-answer is, not by the standard that existed when it was made.
 */
export async function rescoreRun(
  previous: Pick<RunRecord, "childId" | "system" | "source" | "fallbackReason" | "result"> &
    Partial<Pick<RunRecord, "model">>,
  children: EvalChild[],
  calendar: FrozenCalendar
): Promise<RunRecord | null> {
  const child = children.find((profile) => profile.id === previous.childId);
  // A profile added since the earlier run has no earlier answer to judge.
  if (!child) return null;
  const context = await contextFor(child, calendar);
  return {
    childId: previous.childId,
    system: previous.system,
    source: previous.source,
    fallbackReason: previous.fallbackReason,
    result: previous.result,
    score: scoreResult(context, previous.result),
    candidates: context.candidates.length,
    ...(previous.model ? { model: previous.model } : {}),
  };
}
