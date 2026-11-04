import { z } from "zod";
import { roughEstimate, roundTo500 } from "./baseline";
import { assumptionsFor, nightsFor } from "./routes";
import type { Range, Route, RouteEstimate } from "./types";

/**
 * The model's numbers, checked before any parent sees them.
 *
 * ── What the model is asked for, and what it is not ─────────────────────────
 * Only four numbers per route: a low and a high for travel and for stay. It is
 * not asked for the wording that goes with them. The assumptions line a parent
 * reads is ours and identical for every route, so there is no model-written
 * sentence about money to verify, and nothing to get subtly wrong.
 *
 * ── What the checks catch ───────────────────────────────────────────────────
 * A range that is not a range, a figure no trip of this kind could cost, a stay
 * for a trip at home, and a range so wide it says nothing. A route that fails is
 * replaced by the rough estimate, and only that route: the others from the same
 * answer are kept.
 */

const amount = z.number().int().min(0).max(1_000_000);
const rangeSchema = z.object({ low: amount, high: amount });

const outputSchema = z.object({
  routes: z
    .array(
      z.object({
        id: z.string().min(1),
        travel: rangeSchema,
        stay: rangeSchema,
      })
    )
    .max(60),
});

/** Round trip for a child and a parent, including getting around at the venue. */
const MAX_TRAVEL = 60_000;
const MAX_TRAVEL_SAME_STATE = 20_000;
const MAX_TRAVEL_SAME_CITY = 2_000;
/** Per night, for two people, stay and meals together. */
const MAX_STAY_PER_NIGHT = 10_000;
/** A range wider than this multiple of its low end tells a parent nothing. */
const MAX_SPREAD = 4;
const SPREAD_FLOOR = 1_000;

const roundRange = (range: Range): Range => ({
  low: roundTo500(range.low),
  high: roundTo500(range.high),
});

const sane = (range: Range, ceiling: number): boolean =>
  range.low <= range.high &&
  range.high <= ceiling &&
  range.high <= Math.max(range.low, SPREAD_FLOOR) * MAX_SPREAD;

/** Whether a pair of ranges is plausible for this trip. */
export function plausible(travel: Range, stay: Range, route: Route): boolean {
  const nights = nightsFor(route);

  if (route.relation === "same-city") {
    return travel.high <= MAX_TRAVEL_SAME_CITY && stay.low === 0 && stay.high === 0;
  }
  const travelCeiling = route.relation === "same-state" ? MAX_TRAVEL_SAME_STATE : MAX_TRAVEL;
  return (
    sane(travel, travelCeiling) &&
    // A trip away has a stay: a zero range would mean sleeping for free.
    stay.high > 0 &&
    sane(stay, MAX_STAY_PER_NIGHT * nights)
  );
}

/**
 * The usable estimates from a model answer, keyed by route key. Routes the model
 * left out, or got wrong, are simply absent: the caller fills them from the rough
 * table. Null when the answer is not the agreed shape at all.
 */
export function validateCostOutput(
  raw: unknown,
  requested: Map<string, Route>
): Map<string, RouteEstimate> | null {
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) return null;

  const accepted = new Map<string, RouteEstimate>();
  for (const entry of parsed.data.routes) {
    const route = requested.get(entry.id);
    if (!route || accepted.has(route.key)) continue;

    const travel = roundRange(entry.travel);
    const stay = roundRange(entry.stay);
    if (!plausible(travel, stay, route)) continue;

    accepted.set(route.key, { travel, stay, source: "ai", assumptions: assumptionsFor(route) });
  }
  return accepted;
}

/** The rough estimate, restated through the same assumptions line. */
export const roughFor = (route: Route): RouteEstimate => roughEstimate(route);
