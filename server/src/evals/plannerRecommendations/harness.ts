import fs = require("fs");
import path = require("path");
import { annualEntryCap, buildShortlist, type PlannerEdition } from "@powermysport/shared-types";
import type { PlannerOverview } from "../../client/services/PlannerService";
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

/** Ten in the morning UTC on the day the calendar was frozen. */
export const nowFor = (calendar: FrozenCalendar): Date =>
  new Date(`${calendar.frozenOn}T10:00:00.000Z`);

export function overviewFor(child: EvalChild, calendar: FrozenCalendar): PlannerOverview {
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

  return {
    dependentId: child.id,
    dependentName: "Evaluation child",
    sportSlug: "tennis",
    linkState: "ready",
    standing: {
      category: "Boys",
      subcategory: child.ageGroup,
      rank: child.rank,
      totalPoints: null,
      alsoRanked: [],
      state: child.state,
      asOnDate: new Date(`${calendar.frozenOn}T00:00:00.000Z`) as unknown as string,
    },
    annualEntryCap: annualEntryCap(child.ageGroup),
    shortlist,
    plan: {
      dependentId: child.id,
      sportSlug: "tennis",
      entries: [...played, ...planned],
      preferences: {
        goal: child.goal,
        blockedRanges: child.blockedRanges ?? [],
        budget: null,
      },
    },
    editionsConsidered: calendar.editions.length,
  } as unknown as PlannerOverview;
}

export const contextFor = (child: EvalChild, calendar: FrozenCalendar): RecommendationContext => {
  const context = buildContext(overviewFor(child, calendar), nowFor(calendar));
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

export function runRules(child: EvalChild, calendar: FrozenCalendar): RunRecord {
  const context = contextFor(child, calendar);
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
  const context = contextFor(child, calendar);
  const now = nowFor(calendar);
  const userPrompt = buildUserPrompt(context);

  // Nothing to choose from: the service answers from the rules without a model call.
  if (context.candidates.length === 0) {
    const result = baselineRecommend(context, now);
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
      slugs: context.candidates.map((candidate) => candidate.slug),
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
