// ─── Sport archetype system (server-side mirror) ───────────────────────────
//
// Same concept as client/src/modules/find-sport/data/sportArchetypes.ts:
// competitive structure isn't universal across sports, so PathwayService's
// level-generation prompt must not force every sport into a district/state/
// national geographic hierarchy. Kept as a separate server-side copy since
// this repo has no shared package between client and server.

export type SportArchetype = "federation" | "ranking" | "rating" | "standard";

interface SportArchetypeInfo {
  archetype: SportArchetype;
  /** Only meaningful for "standard" — swaps prompt wording between a timed and a scored qualifying standard. */
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
  tennis: { archetype: "ranking" },
  badminton: { archetype: "ranking" },
  "table tennis": { archetype: "ranking" },
  chess: { archetype: "rating" },
  athletics: { archetype: "standard", unit: "time" },
  swimming: { archetype: "standard", unit: "time" },
  shooting: { archetype: "standard", unit: "score" },
};

/** Federation is the safest generic default for sports outside our explicit map — most Indian sports run on a district/state/national structure. */
const DEFAULT_ARCHETYPE_INFO: SportArchetypeInfo = { archetype: "federation" };

function getSportArchetypeInfo(sportName: string): SportArchetypeInfo {
  const key = sportName.trim().toLowerCase();
  return SPORT_ARCHETYPE[key] ?? DEFAULT_ARCHETYPE_INFO;
}

/**
 * Structural guidance injected into the pathway level-generation prompt so
 * levels 2-5 reflect how this sport's progression actually works in India,
 * instead of assuming every sport has a district/state/national geographic
 * ladder (tennis/badminton/table tennis run on ranking tournaments, chess on
 * a rating system, athletics/swimming/shooting on qualifying standards).
 */
export function getLevelScopeGuidance(sportName: string): string {
  const { archetype, unit } = getSportArchetypeInfo(sportName);

  switch (archetype) {
    case "ranking":
      return `This sport is organized around ranking tournaments, not district/state administrative divisions — DO NOT invent a "district level" or "state level" for this sport. STRICTLY MAP the levels to how ranking tournaments actually work in India:
  - Level 2 MUST map to local & state-level ranking tournaments.
  - Level 3 MUST map to national ranking tournaments (top grades).
  - Level 4 MUST map to being nationally ranked.
  - Level 5 MUST map to the international junior circuit (e.g. ITF/BWF-level events).`;

    case "rating":
      return `This sport is organized around a numeric rating system, not district/state administrative divisions — DO NOT invent a "district level" or "state level" for this sport. STRICTLY MAP the levels to how rating progression actually works in India:
  - Level 2 MUST map to being state-rated.
  - Level 3 MUST map to being nationally rated (by the national federation's own rating system, e.g. AICF for chess).
  - Level 4 MUST map to being internationally rated (e.g. FIDE-rated for chess, if applicable to this sport).
  - Level 5 MUST map to being a titled player or competing in international age-group events.`;

    case "standard": {
      const unitWord = unit === "score" ? "score" : "time";
      return `This sport is organized around qualifying ${unitWord} standards, not district/state administrative divisions — DO NOT invent a "district level" or "state level" for this sport. STRICTLY MAP the levels to how qualifying standards actually work in India:
  - Level 2 MUST map to competing at district/club-level meets (no formal qualifying ${unitWord} yet — this is about participation, not a fixed cutoff).
  - Level 3 MUST map to meeting the state qualifying standard.
  - Level 4 MUST map to meeting the national qualifying standard.
  - Level 5 MUST map to meeting the international/Olympic qualifying standard.`;
    }

    case "federation":
    default:
      return `STRICTLY MAP the levels to the geographic scope of competition:
  - Level 2 MUST map to the District / Inter-City / Local competitive level.
  - Level 3 MUST map to the State / Provincial competitive level.
  - Level 4 MUST map to the National competitive level.
  - Level 5 MUST map to the International / Elite competitive level.`;
  }
}

/**
 * Safety-net labels used only if the model omits a level's "label" field.
 * Archetype-aware so the fallback doesn't reintroduce the same district/state
 * assumption the real prompt guidance above was fixed to avoid.
 */
export function getLevelLabelFallbacks(sportName: string): string[] {
  const { archetype } = getSportArchetypeInfo(sportName);

  switch (archetype) {
    case "ranking":
      return ["Beginner", "State Ranking", "National Ranking", "Nationally Ranked", "International Circuit"];
    case "rating":
      return ["Beginner", "State-Rated", "Nationally Rated", "Internationally Rated", "Titled"];
    case "standard":
      return ["Beginner", "Club / District", "State Qualifier", "National Qualifier", "International Qualifier"];
    case "federation":
    default:
      return ["Beginner", "District", "State", "National", "International"];
  }
}
