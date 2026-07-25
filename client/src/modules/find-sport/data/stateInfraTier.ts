import { CITIES } from "./sportProfiles";

// Best (lowest = most metro) CITIES tier known for each state, derived from
// the existing city list so this can't drift out of sync with it.
const bestCityTierByState = new Map<string, 1 | 2 | 3>();
for (const city of CITIES) {
  if (!city.state) continue;
  const current = bestCityTierByState.get(city.state);
  if (current === undefined || city.tier < current) {
    bestCityTierByState.set(city.state, city.tier);
  }
}

// Invert CITIES' "1=metro ... 3=small town" scale to match
// SportProfile.minCityTier's "1=available everywhere ... 3=needs a tier-1
// metro" scale, so a state's available infra can be compared directly
// against what a sport requires.
function invert(cityTier: 1 | 2 | 3): 1 | 2 | 3 {
  return (4 - cityTier) as 1 | 2 | 3;
}

// Neutral default when the parent hasn't picked a state yet — an unanswered
// question should never penalize a sport.
export const DEFAULT_STATE_INFRA_TIER = 2;

// Default for a real state with no known tier-1/tier-2 city in CITIES —
// matches the "Other city / town" entry's own tier-3 (lowest) fallback.
const UNKNOWN_STATE_INFRA_TIER = 1;

// Coarse proxy for sport-infrastructure availability by state, used only to
// soften (not gate) rankings when a sport needs city-tier facilities the
// parent's state mostly lacks. The wizard only collects state, not city, so
// this is necessarily state-level: it takes the best city tier known for
// that state from CITIES.
export function getStateInfraTier(state: string | null): 1 | 2 | 3 {
  if (!state) return DEFAULT_STATE_INFRA_TIER;
  const bestCityTier = bestCityTierByState.get(state);
  if (bestCityTier === undefined) return UNKNOWN_STATE_INFRA_TIER;
  return invert(bestCityTier);
}
