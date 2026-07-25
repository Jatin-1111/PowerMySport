// ─── Sport archetype system (shared) ────────────────────────────────────────
//
// Competitive structure isn't universal across sports. Instead of one ladder
// or a fully bespoke ladder per sport, every sport maps to one of four
// archetypes. This map mirrors server/src/shared/utils/sportArchetypes.ts —
// the server uses it to generate archetype-correct pathway level content, and
// the client uses it to pick which roadmap skeleton renders that content.
//
// - federation: district → state → national selection pyramid (trials)
// - ranking:    tournament ranking points (AITA/BAI/TTFI circuits)
// - rating:     numeric rating milestones (AICF/FIDE for chess)
// - standard:   published qualifying time/score standards (athletics/swimming/shooting)

export type Archetype = "federation" | "ranking" | "rating" | "standard";

export interface SportArchetypeInfo {
  archetype: Archetype;
  /** Only meaningful for the "standard" archetype — swaps wording between a timed and a scored qualifying standard. */
  unit?: "time" | "score";
}

const SPORT_ARCHETYPE: Record<string, SportArchetypeInfo> = {
  cricket: { archetype: "federation" },
  football: { archetype: "federation" },
  basketball: { archetype: "federation" },
  kabaddi: { archetype: "federation" },
  wrestling: { archetype: "federation" },
  volleyball: { archetype: "federation" },
  gymnastics: { archetype: "federation" },
  hockey: { archetype: "federation" },
  tennis: { archetype: "ranking" },
  badminton: { archetype: "ranking" },
  "table tennis": { archetype: "ranking" },
  squash: { archetype: "ranking" },
  chess: { archetype: "rating" },
  athletics: { archetype: "standard", unit: "time" },
  swimming: { archetype: "standard", unit: "time" },
  shooting: { archetype: "standard", unit: "score" },
  archery: { archetype: "standard", unit: "score" },
};

/** Federation is the safest generic default for sports outside our explicit map — most Indian sports run on a district/state/national structure. */
const DEFAULT_ARCHETYPE_INFO: SportArchetypeInfo = { archetype: "federation" };

/** Accepts a sport name ("Table Tennis") or slug ("table-tennis"). */
export function getSportArchetypeInfo(
  sportNameOrSlug: string,
): SportArchetypeInfo {
  const key = sportNameOrSlug
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
  return SPORT_ARCHETYPE[key] ?? DEFAULT_ARCHETYPE_INFO;
}
