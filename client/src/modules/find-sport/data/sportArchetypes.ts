// ─── Sport archetype system ────────────────────────────────────────────────
//
// Competitive structure isn't universal across sports (see
// docs/build-profile-wizard-redesign.md). Instead of one ladder or a fully
// bespoke ladder per sport, every sport maps to one of four archetypes, and
// the "current standing" / "best result" questions in SportKnownFlow render
// whichever ladder matches — the parent never sees the archetype itself.

export type Archetype = "federation" | "ranking" | "rating" | "standard";

export interface LadderTier {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
}

interface SportArchetypeInfo {
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

function getSportArchetypeInfo(sport: string): SportArchetypeInfo {
  const key = sport.trim().toLowerCase();
  return SPORT_ARCHETYPE[key] ?? DEFAULT_ARCHETYPE_INFO;
}

// ─── Ladders ────────────────────────────────────────────────────────────────

const CURRENT_STANDING_LADDERS: Record<Archetype, LadderTier[]> = {
  federation: [
    { value: 1, label: "Just starting — school-level only" },
    { value: 2, label: "Competes at district level" },
    { value: 3, label: "Competes at state level" },
    { value: 4, label: "Competes at national level" },
    { value: 5, label: "International exposure" },
  ],
  ranking: [
    { value: 1, label: "Just starting — no ranking tournaments yet" },
    { value: 2, label: "Plays state-level ranking tournaments" },
    { value: 3, label: "Has an All-India (national) ranking" },
    { value: 4, label: "Ranked in the top tier nationally" },
    { value: 5, label: "Competes on the international junior circuit (ITF / BWF)" },
  ],
  rating: [
    { value: 1, label: "Unrated — just starting" },
    { value: 2, label: "State-rated" },
    { value: 3, label: "Nationally rated (AICF)" },
    { value: 4, label: "Internationally rated (FIDE)" },
    { value: 5, label: "Titled / competes in international age-group events" },
  ],
  standard: [
    { value: 1, label: "Just starting — no {unit} recorded yet" },
    { value: 2, label: "Has a district/club-level {unit}" },
    { value: 3, label: "Meets the state qualifying standard" },
    { value: 4, label: "Meets the national qualifying standard" },
    { value: 5, label: "Meets the international/Olympic qualifying standard" },
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
  return ladder.map((tier) => ({ ...tier, label: tier.label.replace("{unit}", unit) }));
}

export function getCurrentStandingLadder(sport: string): LadderTier[] {
  const { archetype, unit } = getSportArchetypeInfo(sport);
  return resolveLadder(CURRENT_STANDING_LADDERS[archetype], unit);
}

export function getBestResultLadder(sport: string): LadderTier[] {
  const { archetype, unit } = getSportArchetypeInfo(sport);
  return resolveLadder(BEST_RESULT_LADDERS[archetype], unit);
}

// ─── Goals ──────────────────────────────────────────────────────────────────
//
// The 4 ambition values (fun/competitive/national/professional) are shared
// across all sports — scorer.ts weights/gates on these exact strings — but
// what each tier actually MEANS depends on the sport's archetype. "Trying for
// district/state trials" is meaningless for tennis; there's no such thing.

export interface AmbitionOption {
  value: "fun" | "competitive" | "national" | "professional";
  label: string;
  context: string;
}

const AMBITION_OPTIONS: Record<Archetype, AmbitionOption[]> = {
  federation: [
    { value: "fun", label: "Fitness & enjoyment only", context: "Staying active and enjoying the sport" },
    { value: "competitive", label: "Improving for school team", context: "Building up to make or strengthen their school/local team" },
    { value: "national", label: "Trying for district/state trials", context: "Training seriously toward trials this season" },
    { value: "professional", label: "Aiming for academy/national camp selection", context: "Pursuing a serious competitive pathway" },
  ],
  ranking: [
    { value: "fun", label: "Fitness & enjoyment only", context: "Staying active and enjoying the sport" },
    { value: "competitive", label: "Playing state-level ranking tournaments", context: "Building up through state-level ranking events" },
    { value: "national", label: "Earning an All-India (national) ranking", context: "Training seriously to break into the national ranking" },
    { value: "professional", label: "Aiming for the international junior circuit", context: "Pursuing a serious competitive pathway (ITF / BWF level)" },
  ],
  rating: [
    { value: "fun", label: "Just for enjoyment", context: "Playing casually and enjoying the game" },
    { value: "competitive", label: "Building up their state rating", context: "Playing regularly to grow their state rating" },
    { value: "national", label: "Aiming for a national (AICF) rating", context: "Training seriously to earn a national rating" },
    { value: "professional", label: "Aiming for an international (FIDE) rating or title", context: "Pursuing international-level chess seriously" },
  ],
  standard: [
    { value: "fun", label: "Fitness & enjoyment only", context: "Staying active and enjoying the sport" },
    { value: "competitive", label: "Improving their personal best", context: "Building up through school and club-level meets" },
    { value: "national", label: "Training toward the national qualifying standard", context: "Training seriously to hit the national standard" },
    { value: "professional", label: "Aiming for the international/Olympic qualifying standard", context: "Pursuing a serious competitive pathway toward elite qualifying" },
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
