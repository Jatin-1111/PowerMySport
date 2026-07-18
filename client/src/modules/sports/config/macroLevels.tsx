import { PathwayLevel } from "@/modules/sports/services/pathway";
import { MapPin, Shield, Trophy } from "lucide-react";
import { ReactNode } from "react";

// ─── Macro pathway tiers ────────────────────────────────────────────────────
//
// The underlying data model still generates/stores 5 raw levels per sport
// (Beginner/City → District → State → National → International) — see
// SportPathway / PathwayService on the server. Parents found 5 tiers hard to
// hold in their head, so the roadmap page presents them as 3 macro tiers
// instead. This is a presentation-only regrouping: nothing here changes what
// raw level number a piece of content belongs to.

export type MacroLevelId = "beginner" | "intermediate" | "competitive";

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

export interface MacroLevelConfig extends MacroLevelColors {
  id: MacroLevelId;
  label: "Beginner" | "Intermediate" | "Competitive";
  scopeTag: string;
  icon: ReactNode;
  rawLevelNumbers: number[];
  subVariants?: MacroLevelSubVariant[];
}

export const MACRO_LEVEL_CONFIGS: MacroLevelConfig[] = [
  {
    id: "beginner",
    label: "Beginner",
    scopeTag: "City Level",
    icon: <MapPin className="h-5 w-5" />,
    rawLevelNumbers: [1],
    gradient: "from-emerald-500 to-teal-500",
    bg: "from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    scopeTag: "District & State Level",
    icon: <Shield className="h-5 w-5" />,
    rawLevelNumbers: [2, 3],
    gradient: "from-blue-500 to-indigo-500",
    bg: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    text: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    id: "competitive",
    label: "Competitive",
    scopeTag: "National & International",
    icon: <Trophy className="h-5 w-5" />,
    rawLevelNumbers: [4, 5],
    gradient: "from-orange-500 to-amber-500",
    bg: "from-orange-50 to-amber-50",
    border: "border-orange-200",
    text: "text-orange-600",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
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

// ─── Straight talk: funnel honesty + exit value ─────────────────────────────
//
// Deliberately NOT sport-specific statistics — we don't have citable
// federation/Khelo India participation numbers per sport, and inventing them
// would be worse than saying nothing. These are general, defensible truths
// about how every competitive pyramid narrows, and what reaching or stopping
// at each tier is honestly worth — true regardless of which sport a family
// is looking at.
export const FUNNEL_AND_EXIT_VALUE: Record<
  MacroLevelId,
  { funnelNote: string; exitValueNote: string }
> = {
  beginner: {
    funnelNote:
      "This is where almost every child who tries a sport starts — the widest part of the pyramid. Most stay here to build fitness and enjoyment, not to advance further, and that's a complete outcome, not a stopping-short.",
    exitValueNote:
      "Stopping here isn't quitting early — your child gets exercise, teamwork, and focus, and can always pick it back up recreationally later. Nothing invested at this stage is wasted.",
  },
  intermediate: {
    funnelNote:
      "Fewer children reach District or State level than started at City level — that's true in every sport, everywhere. It isn't a judgment on your child; it's how every competitive pyramid narrows.",
    exitValueNote:
      "Reaching this level is a genuine, standalone achievement — most kids who start a sport never get this far. It often supports school/state sports-quota consideration, and it builds discipline and time-management that carries over into academics, whether or not your child competes again.",
  },
  competitive: {
    funnelNote:
      "This is the narrowest part of the pyramid in every sport — a small fraction of those who start ever compete here. Reaching it takes real talent, years of consistent work, and often some good fortune with timing and injury-free health. Most dedicated athletes never reach this tier.",
    exitValueNote:
      "Even without a professional career, reaching National or International level supports sports-quota admission at top Indian universities and stands out on any resume — an achievement very few people, in any field, ever have.",
  },
};

export interface MacroLevel extends MacroLevelConfig {
  rawLevels: PathwayLevel[];
  /** A single representative raw level number/label for consumers (chat context,
   * "personalised plan" links) that need exactly one level, not a set. */
  representativeRawLevel: number;
  representativeLabel: string;
}

/**
 * Group a sport's flat 5-level array into the 3 parent-facing macro tiers.
 * Falls back gracefully if a sport has fewer than 5 levels (e.g. still
 * generating) by only including tiers whose raw levels are present.
 */
export function groupLevelsIntoMacro(levels: PathwayLevel[]): MacroLevel[] {
  const byNumber = new Map(levels.map((l) => [l.level, l]));

  return MACRO_LEVEL_CONFIGS.map((config) => {
    const rawLevels = config.rawLevelNumbers
      .map((n) => byNumber.get(n))
      .filter((l): l is PathwayLevel => !!l);

    // Intermediate's "leading edge" (State) reads better as the representative
    // than District when only one number is needed downstream.
    const representative =
      rawLevels.length > 0 ? rawLevels[rawLevels.length - 1] : undefined;

    return {
      ...config,
      rawLevels,
      representativeRawLevel:
        representative?.level ?? config.rawLevelNumbers[0],
      representativeLabel: representative?.label ?? config.label,
    };
  }).filter((macro) => macro.rawLevels.length > 0);
}

const FEE_TIERS: Record<number, { label: string; low: number; high: number }> =
  {
    1: { label: "₹1,000–₹3,000/mo", low: 1000, high: 3000 },
    2: { label: "₹3,000–₹10,000/mo", low: 3000, high: 10000 },
    3: { label: "₹10,000–₹30,000/mo", low: 10000, high: 30000 },
    4: { label: "₹30,000–₹80,000/mo", low: 30000, high: 80000 },
    5: { label: "Sponsorship / ₹80,000+", low: 80000, high: 150000 },
  };

/** Combined fee-range label spanning a set of raw levels (used for Intermediate's 2-level span). */
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
