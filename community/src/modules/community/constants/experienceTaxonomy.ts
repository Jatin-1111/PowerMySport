import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Apple,
  Award,
  Bike,
  BookOpen,
  Brain,
  Building2,
  Compass,
  Footprints,
  Goal,
  HeartPulse,
  Medal,
  Plane,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Volleyball,
  Wallet,
  Waves,
} from "lucide-react";

/**
 * The Experience taxonomy, client side.
 *
 * The server stores two fields — `sport` and `category` — and the API returns
 * them collapsed into one `topic` string, so a chip has to be able to resolve
 * either. `getTopicMeta` does that; everything else here is display.
 *
 * The slugs must match server/src/community/constants/experience.ts. They are
 * stored in the database, so renaming one is a migration.
 *
 * NOTE: these entries carry `Icon` component references. A server component
 * must never pass one of these objects across into a `"use client"` component
 * as a prop — that kills SSR silently, and it has already cost this codebase
 * the server rendering of five legal pages. Resolve the icon inside the client
 * component instead, which is what every consumer here does.
 */

export interface TopicMeta {
  slug: string;
  label: string;
  /** Tailwind classes for the chip / capsule accent. */
  accent: string;
  Icon: LucideIcon;
}

export interface ExperienceCategory extends TopicMeta {
  /**
   * What the composer asks instead of showing a blank page. The blank page is
   * the reason the old blog read as "write an essay"; a question is answerable
   * in two lines.
   */
  prompt: string;
}

/** What the experience is about. Required on every experience. */
export const EXPERIENCE_CATEGORIES: ExperienceCategory[] = [
  {
    // Slug stays `match-day` while the label reads "Tournament": it is the
    // stored value on every existing post and the server's allowlist key, so
    // changing it is a data migration, not a rename.
    slug: "match-day",
    label: "Tournament",
    prompt: "What happened at the tournament?",
    accent: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: Trophy,
  },
  {
    slug: "training",
    label: "Training",
    prompt: "What changed in training?",
    accent: "bg-blue-50 text-blue-700 border-blue-200",
    Icon: Activity,
  },
  {
    slug: "injury-recovery",
    label: "Injury & recovery",
    prompt: "What did recovery actually look like?",
    accent: "bg-rose-50 text-rose-700 border-rose-200",
    Icon: HeartPulse,
  },
  {
    slug: "choosing-sport",
    label: "Choosing a sport",
    prompt: "How did you land on this sport?",
    accent: "bg-violet-50 text-violet-700 border-violet-200",
    Icon: Compass,
  },
  {
    slug: "finding-academy",
    label: "Finding an academy",
    prompt: "How did the academy search go?",
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: Building2,
  },
  {
    slug: "gear",
    label: "Gear",
    prompt: "What did you buy, and was it worth it?",
    accent: "bg-slate-100 text-slate-700 border-slate-200",
    Icon: ShoppingBag,
  },
  {
    slug: "travel-stay",
    label: "Travel & stay",
    prompt: "How was getting there and staying over?",
    accent: "bg-cyan-50 text-cyan-700 border-cyan-200",
    Icon: Plane,
  },
  {
    slug: "school-balance",
    label: "School vs sport",
    prompt: "How do you balance school and training?",
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
    Icon: BookOpen,
  },
  {
    slug: "money",
    label: "Money & costs",
    prompt: "What did it actually cost?",
    accent: "bg-teal-50 text-teal-700 border-teal-200",
    Icon: Wallet,
  },
  {
    slug: "nutrition",
    label: "Nutrition",
    prompt: "What works at your table?",
    accent: "bg-green-50 text-green-700 border-green-200",
    Icon: Apple,
  },
  {
    slug: "mindset",
    label: "Mindset",
    prompt: "What helped with the head game?",
    accent: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    Icon: Brain,
  },
  {
    slug: "general",
    label: "General",
    prompt: "What do you want other parents to know?",
    accent: "bg-slate-100 text-slate-600 border-slate-200",
    Icon: Sparkles,
  },
];

/** Which sport it concerns, when it concerns one. Optional. */
export const EXPERIENCE_SPORTS: TopicMeta[] = [
  {
    slug: "Cricket",
    label: "Cricket",
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: Trophy,
  },
  { slug: "Football", label: "Football", accent: "bg-sky-50 text-sky-700 border-sky-200", Icon: Goal }, // prettier-ignore
  {
    slug: "Badminton",
    label: "Badminton",
    accent: "bg-violet-50 text-violet-700 border-violet-200",
    Icon: Volleyball,
  },
  {
    slug: "Hockey",
    label: "Hockey",
    accent: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: Award,
  },
  {
    slug: "Tennis",
    label: "Tennis",
    accent: "bg-lime-50 text-lime-700 border-lime-200",
    Icon: Medal,
  },
  {
    slug: "Basketball",
    label: "Basketball",
    accent: "bg-orange-50 text-orange-700 border-orange-200",
    Icon: Target,
  },
  {
    slug: "Athletics",
    label: "Athletics",
    accent: "bg-rose-50 text-rose-700 border-rose-200",
    Icon: Footprints,
  },
  {
    slug: "Swimming",
    label: "Swimming",
    accent: "bg-cyan-50 text-cyan-700 border-cyan-200",
    Icon: Waves,
  },
  {
    slug: "Cycling",
    label: "Cycling",
    accent: "bg-teal-50 text-teal-700 border-teal-200",
    Icon: Bike,
  },
];

/** Everything a chip or filter strip can show, sports first. */
export const ALL_TOPICS: TopicMeta[] = [...EXPERIENCE_SPORTS, ...EXPERIENCE_CATEGORIES];

const TOPIC_MAP = new Map(ALL_TOPICS.map((topic) => [topic.slug.toLowerCase(), topic]));

const FALLBACK = EXPERIENCE_CATEGORIES[EXPERIENCE_CATEGORIES.length - 1];

/** Resolve a `topic` from the API — it may be either a sport or a category. */
export const getTopicMeta = (slug?: string | null): TopicMeta => {
  const found = slug ? TOPIC_MAP.get(slug.toLowerCase()) : undefined;
  return found || FALLBACK;
};

const CATEGORY_MAP = new Map(
  EXPERIENCE_CATEGORIES.map((category) => [category.slug.toLowerCase(), category])
);

export const getExperienceCategory = (slug?: string | null): ExperienceCategory =>
  (slug ? CATEGORY_MAP.get(slug.toLowerCase()) : undefined) || FALLBACK;
