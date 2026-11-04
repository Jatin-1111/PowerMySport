import { assumptionsFor, nightsFor } from "./routes";
import type { Range, Route, RouteEstimate } from "./types";

/**
 * The rule-of-thumb estimate, used when the model is unavailable, over its daily
 * limit, or returns numbers that fail the checks.
 *
 * ── Honest about what it is ─────────────────────────────────────────────────
 * These are coarse bands, not data. They exist so a parent always sees a figure
 * to plan around, and they are labelled "rough" on the page so nobody mistakes
 * them for a quote. They are deliberately wide: a narrow range here would claim
 * precision that nothing behind it has.
 *
 * They assume a child and one parent, economy rail or bus, and a budget hotel
 * with meals, which is also what the model is told to assume.
 */

/** Round to the nearest 500: a figure to the rupee would claim more than we know. */
export const roundTo500 = (value: number): number => Math.round(value / 500) * 500;

const TRAVEL: Record<Route["relation"], Range> = {
  "same-city": { low: 0, high: 1000 },
  "same-state": { low: 2000, high: 7000 },
  "other-state": { low: 7000, high: 28000 },
  // Wide on purpose: we cannot tell how far it is.
  unknown: { low: 3000, high: 28000 },
};

/** Per night for a child and a parent, stay and meals together. */
const STAY_PER_NIGHT: Range = { low: 2000, high: 4500 };

export function roughEstimate(route: Route): RouteEstimate {
  const nights = nightsFor(route);
  const travel = TRAVEL[route.relation];
  return {
    travel: { low: roundTo500(travel.low), high: roundTo500(travel.high) },
    stay: {
      low: roundTo500(STAY_PER_NIGHT.low * nights),
      high: roundTo500(STAY_PER_NIGHT.high * nights),
    },
    source: "rough",
    assumptions: assumptionsFor(route),
  };
}
