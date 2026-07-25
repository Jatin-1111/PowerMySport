import {
  Archetype,
  getSportArchetypeInfo,
} from "@/modules/sports/config/sportArchetypes";
import { PathwayLevel } from "@/modules/sports/services/pathway";
import {
  Award,
  BarChart3,
  BookOpen,
  Compass,
  Crown,
  Dumbbell,
  Flag,
  Gauge,
  Globe,
  MapPin,
  Medal,
  Shield,
  Timer,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { ReactNode } from "react";

// ─── Archetype skeletons ────────────────────────────────────────────────────
//
// The underlying data model still generates/stores 5 raw levels per sport
// (see SportPathway / PathwayService on the server — the generation prompt is
// already archetype-aware via getLevelScopeGuidance). What differs per sport
// is the SKELETON the roadmap page pours those levels into: each of the four
// archetypes groups the raw levels into its own parent-facing stages, with
// its own labels, colors, progression metaphor, and stepper visual.
//
// federation → 3-stage selection pyramid (the original skeleton)
// ranking    → 4-stage tournament-circuit ladder
// rating     → 4-stage rating-milestone climb
// standard   → 4-stage qualifying-marks track

export type MacroLevelId =
  // federation
  | "beginner"
  | "intermediate"
  | "competitive"
  // ranking
  | "foundation"
  | "state-circuit"
  | "national-ranking"
  | "international-circuit"
  // rating
  | "unrated"
  | "state-rated"
  | "national-rated"
  | "fide-titles"
  // standard
  | "technique"
  | "personal-bests"
  | "state-standard"
  | "national-elite";

export interface MacroLevelSubVariant {
  id: "national" | "international";
  rawLevel: number;
  label: string;
  blurb: string;
  accentText: string;
  accentBadge: string;
}

export interface MacroLevelColors {
  gradient: string;
  bg: string;
  border: string;
  text: string;
  badge: string;
}

/** Hex palette the stepper visuals paint with (inline styles, not Tailwind). */
export interface StepperPalette {
  hex: string;
  soft: string;
  ring: string;
  dark: string;
}

export interface MacroLevelConfig extends MacroLevelColors {
  id: MacroLevelId;
  label: string;
  scopeTag: string;
  icon: ReactNode;
  rawLevelNumbers: number[];
  /** "~2–4 years to next" chip shown on the stepper. */
  durationNote: string;
  /** Honest note about how the pyramid narrows at this stage. */
  funnelNote: string;
  /** What reaching (or stopping at) this stage is genuinely worth. */
  exitValueNote: string;
  stepper: StepperPalette;
  subVariants?: MacroLevelSubVariant[];
}

// ─── Federation: selection pyramid ──────────────────────────────────────────

const FEDERATION_SKELETON: MacroLevelConfig[] = [
  {
    id: "beginner",
    label: "Beginner",
    scopeTag: "City Level",
    icon: <MapPin className="h-5 w-5" />,
    rawLevelNumbers: [1],
    durationNote: "~12–18 months to next",
    gradient: "from-emerald-500 to-teal-500",
    bg: "from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    stepper: { hex: "#10b981", soft: "#ecfdf5", ring: "#a7f3d0", dark: "#065f46" },
    funnelNote:
      "This is where almost every child who tries a sport starts — the widest part of the pyramid. Most stay here to build fitness and enjoyment, not to advance further, and that's a complete outcome, not a stopping-short.",
    exitValueNote:
      "Stopping here isn't quitting early — your child gets exercise, teamwork, and focus, and can always pick it back up recreationally later. Nothing invested at this stage is wasted.",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    scopeTag: "District & State Level",
    icon: <Shield className="h-5 w-5" />,
    rawLevelNumbers: [2, 3],
    durationNote: "~2–4 years to next",
    gradient: "from-blue-500 to-indigo-500",
    bg: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    text: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    stepper: { hex: "#f59e0b", soft: "#fffbeb", ring: "#fde68a", dark: "#78350f" },
    funnelNote:
      "Fewer children reach District or State level than started at City level — that's true in every sport, everywhere. It isn't a judgment on your child; it's how every competitive pyramid narrows.",
    exitValueNote:
      "Reaching this level is a genuine, standalone achievement — most kids who start a sport never get this far. It often supports school/state sports-quota consideration, and it builds discipline and time-management that carries over into academics, whether or not your child competes again.",
  },
  {
    id: "competitive",
    label: "Competitive",
    scopeTag: "National & International",
    icon: <Trophy className="h-5 w-5" />,
    rawLevelNumbers: [4, 5],
    durationNote: "Peak stage",
    gradient: "from-orange-500 to-amber-500",
    bg: "from-orange-50 to-amber-50",
    border: "border-orange-200",
    text: "text-orange-600",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    stepper: { hex: "#8b5cf6", soft: "#f5f3ff", ring: "#ddd6fe", dark: "#4c1d95" },
    funnelNote:
      "This is the narrowest part of the pyramid in every sport — a small fraction of those who start ever compete here. Reaching it takes real talent, years of consistent work, and often some good fortune with timing and injury-free health. Most dedicated athletes never reach this tier.",
    exitValueNote:
      "Even without a professional career, reaching National or International level supports sports-quota admission at top Indian universities and stands out on any resume — an achievement very few people, in any field, ever have.",
    subVariants: [
      {
        id: "national",
        rawLevel: 4,
        label: "National",
        blurb:
          "State pride, national rankings, and SAI recognition — a strong domestic career path.",
        accentText: "text-orange-600",
        accentBadge: "bg-orange-100 text-orange-700 border-orange-200",
      },
      {
        id: "international",
        rawLevel: 5,
        label: "International",
        blurb:
          "Compete for India on the world stage, with access to funding via schemes like TOPS.",
        accentText: "text-rose-600",
        accentBadge: "bg-rose-100 text-rose-700 border-rose-200",
      },
    ],
  },
];

// ─── Ranking: tournament-circuit ladder ─────────────────────────────────────

const RANKING_SKELETON: MacroLevelConfig[] = [
  {
    id: "foundation",
    label: "Foundation",
    scopeTag: "Learning & Club Play",
    icon: <Compass className="h-5 w-5" />,
    rawLevelNumbers: [1],
    durationNote: "~1–2 years to first tournaments",
    gradient: "from-sky-500 to-cyan-500",
    bg: "from-sky-50 to-cyan-50",
    border: "border-sky-200",
    text: "text-sky-600",
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    stepper: { hex: "#0ea5e9", soft: "#f0f9ff", ring: "#bae6fd", dark: "#0c4a6e" },
    funnelNote:
      "Almost every child who picks up this sport starts here, and most stay — playing for fitness, focus, and fun. That's a complete outcome in itself, not a stopping-short.",
    exitValueNote:
      "Racquet and match skills last a lifetime — your child can play socially at any age, and the footwork, coordination, and concentration built here carry into every other sport and into the classroom.",
  },
  {
    id: "state-circuit",
    label: "State Circuit",
    scopeTag: "State Ranking Tournaments",
    icon: <Flag className="h-5 w-5" />,
    rawLevelNumbers: [2],
    durationNote: "~1–3 years on the circuit",
    gradient: "from-blue-500 to-indigo-500",
    bg: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    text: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    stepper: { hex: "#3b82f6", soft: "#eff6ff", ring: "#bfdbfe", dark: "#1e3a8a" },
    funnelNote:
      "This is where the sport changes shape: progress is measured in ranking points earned at tournaments, not selection trials. Far fewer children play ranking events than take coaching — entering at all already puts your child in a small group.",
    exitValueNote:
      "Playing state ranking tournaments teaches your child to compete under pressure, win and lose graciously, and manage nerves — skills that show up in exams and interviews. A state tournament record also supports school sports-quota consideration.",
  },
  {
    id: "national-ranking",
    label: "National Ranking",
    scopeTag: "All-India Ranked",
    icon: <BarChart3 className="h-5 w-5" />,
    rawLevelNumbers: [3, 4],
    durationNote: "~2–4 years to the top tier",
    gradient: "from-indigo-500 to-violet-500",
    bg: "from-indigo-50 to-violet-50",
    border: "border-indigo-200",
    text: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    stepper: { hex: "#6366f1", soft: "#eef2ff", ring: "#c7d2fe", dark: "#312e81" },
    funnelNote:
      "Earning an All-India ranking means beating players from across the country, tournament after tournament. Only a small fraction of state-circuit players get here — travel, cost, and training hours all step up sharply.",
    exitValueNote:
      "A national ranking is a documented, verifiable achievement — it strongly supports sports-quota admission at top universities and stands out in any application, whether or not your child turns professional.",
  },
  {
    id: "international-circuit",
    label: "International Circuit",
    scopeTag: "ITF / BWF / WTT Juniors",
    icon: <Globe className="h-5 w-5" />,
    rawLevelNumbers: [5],
    durationNote: "Peak stage",
    gradient: "from-violet-500 to-purple-500",
    bg: "from-violet-50 to-purple-50",
    border: "border-violet-200",
    text: "text-violet-600",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    stepper: { hex: "#8b5cf6", soft: "#f5f3ff", ring: "#ddd6fe", dark: "#4c1d95" },
    funnelNote:
      "The international junior circuit is the narrowest rung of the ladder — a handful of players per age group in the whole country compete here. Reaching it takes talent, years of work, funding, and luck with health and timing.",
    exitValueNote:
      "Even without a professional career, competing internationally opens doors for life: elite university admission in India and abroad, high-level coaching careers, and a network most athletes never access.",
  },
];

// ─── Rating: numeric-rating milestones ──────────────────────────────────────

const RATING_SKELETON: MacroLevelConfig[] = [
  {
    id: "unrated",
    label: "Learning the Game",
    scopeTag: "Unrated",
    icon: <BookOpen className="h-5 w-5" />,
    rawLevelNumbers: [1],
    durationNote: "~6–18 months to rated play",
    gradient: "from-teal-500 to-emerald-500",
    bg: "from-teal-50 to-emerald-50",
    border: "border-teal-200",
    text: "text-teal-600",
    badge: "bg-teal-100 text-teal-700 border-teal-200",
    stepper: { hex: "#14b8a6", soft: "#f0fdfa", ring: "#99f6e4", dark: "#134e4a" },
    funnelNote:
      "Every player starts unrated. Most children play for the love of the game — school events, online play, family games — and never chase a rating. That's a complete outcome, not falling behind.",
    exitValueNote:
      "This game sharpens memory, patience, and planning like almost nothing else — benefits your child keeps forever, whether or not they ever play a rated event.",
  },
  {
    id: "state-rated",
    label: "State Rated",
    scopeTag: "First Official Rating",
    icon: <Award className="h-5 w-5" />,
    rawLevelNumbers: [2],
    durationNote: "~1–2 years of rated events",
    gradient: "from-sky-500 to-blue-500",
    bg: "from-sky-50 to-blue-50",
    border: "border-sky-200",
    text: "text-sky-600",
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    stepper: { hex: "#0ea5e9", soft: "#f0f9ff", ring: "#bae6fd", dark: "#0c4a6e" },
    funnelNote:
      "From here progress is a number: an official rating that rises and falls with every result. Earning a first rating already separates your child from the vast majority who only play casually.",
    exitValueNote:
      "A rating gives your child a clear, honest measure of progress and teaches them to handle wins and losses objectively. Rated tournament experience also counts toward school and district recognition.",
  },
  {
    id: "national-rated",
    label: "National Rating",
    scopeTag: "AICF Rated",
    icon: <TrendingUp className="h-5 w-5" />,
    rawLevelNumbers: [3],
    durationNote: "~2–3 years to international level",
    gradient: "from-indigo-500 to-violet-500",
    bg: "from-indigo-50 to-violet-50",
    border: "border-indigo-200",
    text: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    stepper: { hex: "#6366f1", soft: "#eef2ff", ring: "#c7d2fe", dark: "#312e81" },
    funnelNote:
      "A national (AICF) rating means competing in serious national-circuit events. The field thins sharply here — sustained coaching, study hours, and tournament travel become part of family life.",
    exitValueNote:
      "A national rating is a verifiable credential that supports sports-quota admission and scholarships, and the deep study habits built at this level transfer directly to academics.",
  },
  {
    id: "fide-titles",
    label: "FIDE & Titles",
    scopeTag: "International Rating & Titles",
    icon: <Crown className="h-5 w-5" />,
    rawLevelNumbers: [4, 5],
    durationNote: "Peak stage",
    gradient: "from-amber-500 to-orange-500",
    bg: "from-amber-50 to-orange-50",
    border: "border-amber-200",
    text: "text-amber-600",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    stepper: { hex: "#f59e0b", soft: "#fffbeb", ring: "#fde68a", dark: "#78350f" },
    funnelNote:
      "International ratings and titles (like CM, FM, IM, GM in chess) are the summit — a tiny fraction of rated players in India ever earn one. It takes years of intense study, strong coaching, and international tournament play.",
    exitValueNote:
      "An international rating or title is respected worldwide and permanent — it opens coaching, academic, and career doors globally, and titled players are sought after by universities in India and abroad.",
  },
];

// ─── Standard: qualifying-marks track ───────────────────────────────────────

const STANDARD_SKELETON: MacroLevelConfig[] = [
  {
    id: "technique",
    label: "Foundation",
    scopeTag: "Technique First",
    icon: <Dumbbell className="h-5 w-5" />,
    rawLevelNumbers: [1],
    durationNote: "~1–2 years of technique work",
    gradient: "from-emerald-500 to-teal-500",
    bg: "from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    stepper: { hex: "#10b981", soft: "#ecfdf5", ring: "#a7f3d0", dark: "#065f46" },
    funnelNote:
      "Everyone starts here, and most stay — training for fitness and enjoyment without ever chasing a qualifying mark. That's a complete outcome in itself.",
    exitValueNote:
      "Sound technique, general fitness, and training discipline built here last a lifetime, whatever your child goes on to do.",
  },
  {
    id: "personal-bests",
    label: "Personal Bests",
    scopeTag: "Club & District Meets",
    icon: <Timer className="h-5 w-5" />,
    rawLevelNumbers: [2],
    durationNote: "~1–2 years of regular meets",
    gradient: "from-cyan-500 to-sky-500",
    bg: "from-cyan-50 to-sky-50",
    border: "border-cyan-200",
    text: "text-cyan-600",
    badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
    stepper: { hex: "#06b6d4", soft: "#ecfeff", ring: "#a5f3fc", dark: "#164e63" },
    funnelNote:
      "From here progress is measured against the clock or scoreboard, not a selector's opinion. Your child competes mainly with their own personal best — and far fewer athletes compete at meets than just train.",
    exitValueNote:
      "Chasing personal bests teaches goal-setting and honest self-measurement better than almost any classroom. Recorded marks at district meets are the first entries on a sporting CV.",
  },
  {
    id: "state-standard",
    label: "State Standard",
    scopeTag: "State Qualifying Mark",
    icon: <Gauge className="h-5 w-5" />,
    rawLevelNumbers: [3],
    durationNote: "~2–3 years to national marks",
    gradient: "from-blue-500 to-indigo-500",
    bg: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    text: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    stepper: { hex: "#3b82f6", soft: "#eff6ff", ring: "#bfdbfe", dark: "#1e3a8a" },
    funnelNote:
      "State qualifying standards are fixed, published marks — either your child's mark meets the bar or it doesn't. It's transparent, but unforgiving: most club athletes never reach a state mark, and that's normal.",
    exitValueNote:
      "Meeting a state standard is a black-and-white, verifiable achievement that supports sports-quota admission — no selector's opinion involved, just the mark.",
  },
  {
    id: "national-elite",
    label: "National & Elite",
    scopeTag: "National / Olympic Standards",
    icon: <Medal className="h-5 w-5" />,
    rawLevelNumbers: [4, 5],
    durationNote: "Peak stage",
    gradient: "from-rose-500 to-red-500",
    bg: "from-rose-50 to-red-50",
    border: "border-rose-200",
    text: "text-rose-600",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    stepper: { hex: "#f43f5e", soft: "#fff1f2", ring: "#fecdd3", dark: "#881337" },
    funnelNote:
      "National and international qualifying standards are the sharpest filters in sport — a tiny fraction of state qualifiers ever meet them. Full-time training, sports-science support, and years of consistency are the price of entry.",
    exitValueNote:
      "An athlete who has met a national qualifying standard carries a lifelong, provable credential — elite university admission, government sports jobs, and SAI/TOPS support all recognise it.",
  },
];

export const ARCHETYPE_SKELETONS: Record<Archetype, MacroLevelConfig[]> = {
  federation: FEDERATION_SKELETON,
  ranking: RANKING_SKELETON,
  rating: RATING_SKELETON,
  standard: STANDARD_SKELETON,
};

// ─── Archetype meta: how progression works, in parent language ──────────────

export interface ArchetypeMeta {
  /** Short name for this journey structure, shown as a chip on the result header. */
  label: string;
  /** The "currency" of advancement, e.g. "ranking points". */
  currency: string;
  /**
   * One-sentence explainer rendered above the stepper. May contain "{unit}"
   * which resolves to the sport's qualifying unit (time/score).
   */
  howYouAdvance: string;
}

export const ARCHETYPE_META: Record<Archetype, ArchetypeMeta> = {
  federation: {
    label: "Selection Ladder",
    currency: "selection at trials",
    howYouAdvance:
      "In this sport, your child moves up by being selected — school and club teams first, then district, state, and national trials run by the sport's federation.",
  },
  ranking: {
    label: "Ranking Circuit",
    currency: "tournament ranking points",
    howYouAdvance:
      "In this sport, your child moves up by earning ranking points in tournaments — not by selection trials. Play more events, win more matches, climb the ranking ladder.",
  },
  rating: {
    label: "Rating Milestones",
    currency: "an official rating number",
    howYouAdvance:
      "In this sport, progress is a number: an official rating that rises with every win over rated players. There are no selection trials to pass — the rating is the pathway.",
  },
  standard: {
    label: "Qualifying Standards",
    currency: "published qualifying marks",
    howYouAdvance:
      "In this sport, your child moves up by meeting published qualifying {unit} standards — beat the mark at an official meet and the next level opens automatically.",
  },
};

/** Resolve the "{unit}" placeholder in archetype copy. */
export function resolveArchetypeCopy(
  copy: string,
  unit?: "time" | "score",
): string {
  return copy.replace("{unit}", unit ?? "time or score");
}

// ─── Grouping ────────────────────────────────────────────────────────────────

export interface MacroLevel extends MacroLevelConfig {
  rawLevels: PathwayLevel[];
  /** A single representative raw level number/label for consumers (chat context,
   * "personalised plan" links) that need exactly one level, not a set. */
  representativeRawLevel: number;
  representativeLabel: string;
}

/**
 * Group a sport's flat 5-level array into the parent-facing stages of the
 * given archetype's skeleton. Falls back gracefully if a sport has fewer than
 * 5 levels (e.g. still generating) by only including stages whose raw levels
 * are present.
 */
export function groupLevelsIntoMacro(
  levels: PathwayLevel[],
  archetype: Archetype = "federation",
): MacroLevel[] {
  const byNumber = new Map(levels.map((l) => [l.level, l]));

  return ARCHETYPE_SKELETONS[archetype]
    .map((config) => {
      const rawLevels = config.rawLevelNumbers
        .map((n) => byNumber.get(n))
        .filter((l): l is PathwayLevel => !!l);

      // A merged stage's "leading edge" (e.g. State within District & State)
      // reads better as the representative when only one number is needed.
      const representative =
        rawLevels.length > 0 ? rawLevels[rawLevels.length - 1] : undefined;

      return {
        ...config,
        rawLevels,
        representativeRawLevel:
          representative?.level ?? config.rawLevelNumbers[0],
        representativeLabel: representative?.label ?? config.label,
      };
    })
    .filter((macro) => macro.rawLevels.length > 0);
}

/** Index of the skeleton stage that contains a raw level (1–5), or 0. */
export function stageIndexForRawLevel(
  archetype: Archetype,
  rawLevel: number,
): number {
  const idx = ARCHETYPE_SKELETONS[archetype].findIndex((s) =>
    s.rawLevelNumbers.includes(rawLevel),
  );
  return idx >= 0 ? idx : 0;
}

/** Convenience: skeleton + meta for a sport name/slug in one call. */
export function getArchetypeForSport(sportNameOrSlug: string): {
  archetype: Archetype;
  unit?: "time" | "score";
  meta: ArchetypeMeta;
} {
  const { archetype, unit } = getSportArchetypeInfo(sportNameOrSlug);
  return { archetype, unit, meta: ARCHETYPE_META[archetype] };
}

// ─── Fee ranges & age merging (archetype-independent helpers) ────────────────

const FEE_TIERS: Record<number, { label: string; low: number; high: number }> =
  {
    1: { label: "₹1,000–₹3,000/mo", low: 1000, high: 3000 },
    2: { label: "₹3,000–₹10,000/mo", low: 3000, high: 10000 },
    3: { label: "₹10,000–₹30,000/mo", low: 10000, high: 30000 },
    4: { label: "₹30,000–₹80,000/mo", low: 30000, high: 80000 },
    5: { label: "Sponsorship / ₹80,000+", low: 80000, high: 150000 },
  };

/** Numeric fee bounds across a stage's raw levels — for budget-fit comparisons. */
export function getFeeBounds(
  rawLevelNumbers: number[],
): { low: number; high: number } | null {
  const tiers = rawLevelNumbers.map((n) => FEE_TIERS[n]).filter(Boolean);
  if (tiers.length === 0) return null;
  return {
    low: Math.min(...tiers.map((t) => t.low)),
    high: Math.max(...tiers.map((t) => t.high)),
  };
}

/** Combined fee-range label spanning a set of raw levels (used for stages that span 2 levels). */
export function getCombinedFeeRange(rawLevelNumbers: number[]): string {
  const tiers = rawLevelNumbers.map((n) => FEE_TIERS[n]).filter(Boolean);
  if (tiers.length === 0) return "Varies";
  if (tiers.length === 1) return tiers[0].label;
  const low = Math.min(...tiers.map((t) => t.low));
  const high = Math.max(...tiers.map((t) => t.high));
  return `₹${low.toLocaleString("en-IN")}–₹${high.toLocaleString("en-IN")}/mo`;
}

/**
 * Merge age-range strings like "9 – 12 years" and "11 – 14 years" into a single
 * "9 – 14 years" span, instead of naively concatenating both full strings
 * (which reads as "9 – 12 years – 11 – 14 years").
 */
export function mergeAgeRanges(
  ranges: (string | undefined)[],
): string | undefined {
  const present = ranges.filter((r): r is string => !!r);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  const allNumbers = present.flatMap((r) =>
    (r.match(/\d+/g) || []).map(Number),
  );
  if (allNumbers.length === 0) return present.join(" – ");
  const suffix = present[present.length - 1].replace(/[\d\s–-]+/g, "").trim();
  return `${Math.min(...allNumbers)} – ${Math.max(...allNumbers)} ${suffix}`.trim();
}
