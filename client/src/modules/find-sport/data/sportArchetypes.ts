// ─── Sport archetype system ────────────────────────────────────────────────
//
// Competitive structure isn't universal across sports (see
// docs/build-profile-wizard-redesign.md). Instead of one ladder or a fully
// bespoke ladder per sport, every sport maps to one of four archetypes, and
// the "current standing" / "best result" questions in SportKnownFlow render
// whichever ladder matches — the parent never sees the archetype itself.
//
// The archetype map itself is shared with the roadmap skeletons — see
// @/modules/sports/config/sportArchetypes. This file keeps only the
// wizard-facing ladders and ambition options.

import {
  getSportArchetypeInfo,
  normalizeSportKey,
  type Archetype,
} from "@/modules/sports/config/sportArchetypes";
import { getSportLadderByKey, type LadderTier } from "./sportLadders";

export type { Archetype, LadderTier };

// ─── Ladders ────────────────────────────────────────────────────────────────
//
// Tier 1 in every ladder means "no competitive record yet" — nothing more.
// It must NOT imply either axis of "beginner": not duration (a child can
// train for years before their first ranking tournament — many circuits have
// age floors) and not commitment (a child can train at a serious/academy
// level and still have zero ranking, rating, or trial record). The label
// stays purely factual about the record; the context line hedges both axes
// explicitly so neither a casual player nor a professional-track prospect
// with no ranking yet feels mischaracterized.

const CURRENT_STANDING_LADDERS: Record<Archetype, LadderTier[]> = {
  federation: [
    {
      value: 1,
      label: "No trials yet",
      context: "Hasn't reached district trials yet — no matter how long or how seriously they've trained",
    },
    { value: 2, label: "District level", context: "Competes at district level" },
    { value: 3, label: "State level", context: "Competes at state level" },
    { value: 4, label: "National level", context: "Competes at national level" },
    { value: 5, label: "International", context: "Has international exposure" },
  ],
  ranking: [
    {
      value: 1,
      label: "No ranking yet",
      context: "Hasn't entered ranking tournaments yet — no matter how long or how seriously they've trained",
    },
    { value: 2, label: "State ranking", context: "Plays state-level ranking tournaments" },
    { value: 3, label: "All-India ranking", context: "Has an All-India (national) ranking" },
    { value: 4, label: "Top national tier", context: "Ranked in the top tier nationally" },
    {
      value: 5,
      label: "International circuit",
      context: "Competes on the international junior circuit (ITF / BWF)",
    },
  ],
  rating: [
    {
      value: 1,
      label: "Unrated",
      context: "Not yet officially rated — no matter how long or how seriously they've trained",
    },
    { value: 2, label: "State-rated", context: "Has a state rating" },
    { value: 3, label: "Nationally rated", context: "Has a national (AICF) rating" },
    { value: 4, label: "Internationally rated", context: "Has an international (FIDE) rating" },
    {
      value: 5,
      label: "Titled",
      context: "Titled, or competes in international age-group events",
    },
  ],
  standard: [
    {
      value: 1,
      label: "No {unit} yet",
      context: "No {unit} recorded yet — no matter how long or how seriously they've trained",
    },
    { value: 2, label: "District/club level", context: "Has a district/club-level {unit}" },
    { value: 3, label: "State standard", context: "Meets the state qualifying standard" },
    { value: 4, label: "National standard", context: "Meets the national qualifying standard" },
    {
      value: 5,
      label: "International standard",
      context: "Meets the international/Olympic qualifying standard",
    },
  ],
};

const BEST_RESULT_LADDERS: Record<Archetype, LadderTier[]> = {
  federation: [
    { value: 1, label: "None yet" },
    { value: 2, label: "District-level win or selection" },
    { value: 3, label: "State-level win or selection" },
    { value: 4, label: "National-level selection or medal" },
    { value: 5, label: "International selection or medal" },
  ],
  ranking: [
    { value: 1, label: "None yet" },
    { value: 2, label: "Won a state-level ranking tournament" },
    { value: 3, label: "Earned an All-India (national) ranking" },
    { value: 4, label: "Reached the top tier of the national ranking" },
    { value: 5, label: "Competed on the international junior circuit" },
  ],
  rating: [
    { value: 1, label: "None yet — unrated" },
    { value: 2, label: "Achieved a state rating" },
    { value: 3, label: "Achieved a national (AICF) rating" },
    { value: 4, label: "Achieved an international (FIDE) rating" },
    { value: 5, label: "Earned a title or competed internationally" },
  ],
  standard: [
    { value: 1, label: "None yet" },
    { value: 2, label: "Recorded a district/club-level {unit}" },
    { value: 3, label: "Met the state qualifying standard" },
    { value: 4, label: "Met the national qualifying standard" },
    { value: 5, label: "Met the international/Olympic qualifying standard" },
  ],
};

function resolveLadder(ladder: LadderTier[], unit: "time" | "score" | undefined): LadderTier[] {
  if (!unit) return ladder;
  return ladder.map((tier) => ({
    ...tier,
    label: tier.label.replace("{unit}", unit),
    context: tier.context?.replace("{unit}", unit),
  }));
}

// A hand-authored ladder for the sport wins over its archetype's generic one —
// see sportLadders.ts for why, and for the rules on adding a sport there.

export function getCurrentStandingLadder(sport: string): LadderTier[] {
  const override = getSportLadderByKey(normalizeSportKey(sport));
  if (override) return override.currentStanding;
  const { archetype, unit } = getSportArchetypeInfo(sport);
  return resolveLadder(CURRENT_STANDING_LADDERS[archetype], unit);
}

export function getBestResultLadder(sport: string): LadderTier[] {
  const override = getSportLadderByKey(normalizeSportKey(sport));
  if (override) return override.bestResult;
  const { archetype, unit } = getSportArchetypeInfo(sport);
  return resolveLadder(BEST_RESULT_LADDERS[archetype], unit);
}

/**
 * Whether the "best result so far" question is worth asking for this sport.
 *
 * In a ranking or rating sport it is not: HAVING the ranking IS the result, so
 * the question re-asks the current-standing ladder in the past tense and the
 * parent answers the same rung twice. (Tennis is the clearest case — every
 * AITA player has a ranking, so "current level" already carries the record.)
 * Those sports fall through to the free-text `achievementsNote` instead, which
 * is where a real result — a tournament win, a career-high rank — actually
 * lives.
 *
 * Federation and standard sports keep the question, because there the two
 * genuinely diverge: a child selected for the state side last season may not
 * be in it now, and a personal-best time set last year still stands as a
 * result today.
 *
 * NOTE: this gates only whether the question is ASKED. `getBestResultLadder`
 * stays defined for every archetype, because tiers already stored on existing
 * Player rows still have to render their label wherever the profile is shown.
 */
export function sportAsksBestResult(sport: string): boolean {
  const { archetype } = getSportArchetypeInfo(sport);
  return archetype !== "ranking" && archetype !== "rating";
}

/**
 * Short name of the body whose ladder the parent is being asked about ("AITA")
 * — surfaced in the question copy so they're answering about a real circuit
 * rather than an abstract "ranking". Null for sports still on the generic
 * archetype fallback, where there is no single body to name.
 */
export function getGoverningBodyName(sport: string): string | null {
  return getSportLadderByKey(normalizeSportKey(sport))?.bodyName ?? null;
}

// ─── Goals ──────────────────────────────────────────────────────────────────
//
// The 4 ambition values (fun/competitive/national/career) are shared across all
// sports — scorer.ts weights/gates on these exact strings — but what each tier
// actually MEANS depends on the sport's archetype. "Trying for district/state
// trials" is meaningless for tennis; there's no such thing.
//
// Two deliberate changes from the original list:
//
// 1. The state rung is gone from the RANKING and RATING archetypes, matching
//    their standing ladders. There is no state-level ranking tournament in
//    tennis and no state rating in chess, so a goal phrased around one asked
//    the parent to aim at something that doesn't exist. Federation sports keep
//    their state rung — there the selection pyramid is real.
//
// 2. The top option is now "career" rather than "professional". Chasing the
//    international junior circuit is a goal a handful of Indian families hold;
//    building a livelihood through sport — the sports-quota job, the college
//    place, turning pro — is the one most of them actually have, and it wasn't
//    on the list at all. "professional" stays in the TYPE for rows already
//    written with it, but is no longer offered.

export interface AmbitionOption {
  value: "fun" | "competitive" | "national" | "career" | "professional";
  label: string;
  context: string;
}

const CAREER_CONTEXT = "A sports-quota job, a college place, or turning pro";

const AMBITION_OPTIONS: Record<Archetype, AmbitionOption[]> = {
  federation: [
    { value: "fun", label: "Fitness & enjoyment only", context: "Staying active and enjoying the sport" },
    { value: "competitive", label: "Improving for school team", context: "Building up to make or strengthen their school/local team" },
    { value: "national", label: "Trying for district/state trials", context: "Training seriously toward trials this season" },
    { value: "career", label: "Building a career in sport", context: CAREER_CONTEXT },
  ],
  ranking: [
    { value: "fun", label: "Fitness & enjoyment only", context: "Staying active and enjoying the sport" },
    { value: "competitive", label: "Playing ranking tournaments", context: "Entering the junior circuit and building a ranking" },
    { value: "national", label: "Earning an All-India (national) ranking", context: "Training seriously to break into the national ranking" },
    { value: "career", label: "Building a career in sport", context: CAREER_CONTEXT },
  ],
  rating: [
    { value: "fun", label: "Just for enjoyment", context: "Playing casually and enjoying the game" },
    { value: "competitive", label: "Playing rated tournaments", context: "Playing regularly to earn and grow a rating" },
    { value: "national", label: "Aiming for a national (AICF) rating", context: "Training seriously to earn a national rating" },
    { value: "career", label: "Building a career in chess", context: CAREER_CONTEXT },
  ],
  standard: [
    { value: "fun", label: "Fitness & enjoyment only", context: "Staying active and enjoying the sport" },
    { value: "competitive", label: "Improving their personal best", context: "Building up through school and club-level meets" },
    { value: "national", label: "Training toward the national qualifying standard", context: "Training seriously to hit the national standard" },
    { value: "career", label: "Building a career in sport", context: CAREER_CONTEXT },
  ],
};

export function getAmbitionOptions(sport: string): AmbitionOption[] {
  const { archetype } = getSportArchetypeInfo(sport);
  return AMBITION_OPTIONS[archetype];
}

// ─── Backward-compat derivation ────────────────────────────────────────────
//
// PathwayExplorerSection.tsx and the marketing /guidance page's guidanceUtils.ts
// both hard-consume the exact 3-tier experienceLevel enum. Rather than touch
// either, the 5-tier currentStandingTier collapses down to the legacy shape.

export function deriveExperienceLevel(
  tier: number | null | undefined,
): "beginner" | "intermediate" | "competitive" | undefined {
  if (tier == null) return undefined;
  if (tier <= 2) return "beginner";
  if (tier === 3) return "intermediate";
  return "competitive";
}
