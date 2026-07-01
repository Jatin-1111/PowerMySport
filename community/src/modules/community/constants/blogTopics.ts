import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Apple,
  Award,
  Bike,
  Brain,
  Dumbbell,
  Flame,
  Footprints,
  Goal,
  Medal,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Volleyball,
  Waves,
} from "lucide-react";

export interface BlogTopic {
  slug: string;
  label: string;
  /** Tailwind classes for the chip / capsule accent. */
  accent: string;
  Icon: LucideIcon;
}

/**
 * Curated topics for the "Explore trending topics" strip, the topic filter,
 * and the write form. `slug` is stored as the blog's `topic` field.
 */
export const BLOG_TOPICS: BlogTopic[] = [
  { slug: "Cricket", label: "Cricket", accent: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: Trophy },
  { slug: "Football", label: "Football", accent: "bg-sky-50 text-sky-700 border-sky-200", Icon: Goal },
  { slug: "Badminton", label: "Badminton", accent: "bg-violet-50 text-violet-700 border-violet-200", Icon: Volleyball },
  { slug: "Hockey", label: "Hockey", accent: "bg-amber-50 text-amber-700 border-amber-200", Icon: Award },
  { slug: "Tennis", label: "Tennis", accent: "bg-lime-50 text-lime-700 border-lime-200", Icon: Medal },
  { slug: "Basketball", label: "Basketball", accent: "bg-orange-50 text-orange-700 border-orange-200", Icon: Target },
  { slug: "Athletics", label: "Athletics", accent: "bg-rose-50 text-rose-700 border-rose-200", Icon: Footprints },
  { slug: "Swimming", label: "Swimming", accent: "bg-cyan-50 text-cyan-700 border-cyan-200", Icon: Waves },
  { slug: "Cycling", label: "Cycling", accent: "bg-teal-50 text-teal-700 border-teal-200", Icon: Bike },
  { slug: "Fitness", label: "Fitness", accent: "bg-indigo-50 text-indigo-700 border-indigo-200", Icon: Dumbbell },
  { slug: "Nutrition", label: "Nutrition", accent: "bg-green-50 text-green-700 border-green-200", Icon: Apple },
  { slug: "Training", label: "Training", accent: "bg-blue-50 text-blue-700 border-blue-200", Icon: Activity },
  { slug: "Mindset", label: "Mindset", accent: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", Icon: Brain },
  { slug: "Recovery", label: "Recovery", accent: "bg-pink-50 text-pink-700 border-pink-200", Icon: Flame },
  { slug: "Gear", label: "Gear", accent: "bg-slate-100 text-slate-700 border-slate-200", Icon: ShoppingBag },
  { slug: "General", label: "General", accent: "bg-slate-100 text-slate-600 border-slate-200", Icon: Sparkles },
];

const TOPIC_MAP = new Map(BLOG_TOPICS.map((topic) => [topic.slug.toLowerCase(), topic]));

export const getBlogTopic = (slug?: string | null): BlogTopic => {
  const found = slug ? TOPIC_MAP.get(slug.toLowerCase()) : undefined;
  return found || BLOG_TOPICS[BLOG_TOPICS.length - 1];
};
