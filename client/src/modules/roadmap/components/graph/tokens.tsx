"use client";

// ─── Graph visual language ──────────────────────────────────────────────────
//
// The four edge kinds are the whole reason this UI exists, so their visual
// distinction has to be unmissable and consistent everywhere it appears — on
// the canvas, in the legend, and in the inspector header. Defining them once
// here is what keeps those three in sync.

import {
  Briefcase,
  CircleDot,
  Compass,
  Crown,
  Flag,
  GraduationCap,
  Heart,
  Landmark,
  MapPin,
  Medal,
  Shield,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  UserCheck,
} from "lucide-react";
import { ReactNode } from "react";

import { GOALS } from "../../graph/goals";
import { EdgeKind, GoalAccent, IconKey, LaneTone, NodeKind } from "../../graph/types";

export const NODE_ICONS: Record<IconKey, ReactNode> = {
  start: <Compass className="h-full w-full" />,
  coach: <UserCheck className="h-full w-full" />,
  ball: <CircleDot className="h-full w-full" />,
  briefcase: <Briefcase className="h-full w-full" />,
  school: <GraduationCap className="h-full w-full" />,
  city: <MapPin className="h-full w-full" />,
  state: <Shield className="h-full w-full" />,
  national: <Flag className="h-full w-full" />,
  world: <Landmark className="h-full w-full" />,
  rating: <TrendingUp className="h-full w-full" />,
  trophy: <Trophy className="h-full w-full" />,
  medal: <Medal className="h-full w-full" />,
  crown: <Crown className="h-full w-full" />,
  college: <GraduationCap className="h-full w-full" />,
  timer: <Timer className="h-full w-full" />,
  heart: <Heart className="h-full w-full" />,
};

export function nodeIcon(key: IconKey | undefined): ReactNode {
  return key ? NODE_ICONS[key] : <Sparkles className="h-full w-full" />;
}

// ─── Lane tones ─────────────────────────────────────────────────────────────
//
// A lane borrows the palette of the destination it heads for, so the tint on a
// card answers "what is this track for?" before any text is read — and it stays
// in sync with the goal rail for free, because it IS the goal rail's palette.
//
// The trunk is the deliberate exception: graphite, not a colour. It's the default
// route rather than one option among five, and giving it a hue of its own would
// put six competing colours on a diagram whose line styles already carry meaning.
export const LANE_TONES: Record<LaneTone, GoalAccent> = {
  pro: GOALS.pro.accent,
  national: GOALS.national.accent,
  college: GOALS.college.accent,
  job: GOALS.job.accent,
  state: GOALS.state.accent,
  thrive: GOALS.thrive.accent,
  ladder: { hex: "#475569", soft: "#f8fafc", ring: "#e2e8f0", dark: "#0f172a" },
};

// ─── Edge kinds ─────────────────────────────────────────────────────────────

export interface EdgeStyle {
  /** Human name used in the legend and the inspector header. */
  name: string;
  /** One line on what this kind of connection means. */
  meaning: string;
  hex: string;
  /** Colour when the edge is dimmed out of the active path. */
  mutedHex: string;
  width: number;
  /** SVG dash array, or undefined for solid. */
  dash?: string;
  /** Tailwind classes for the inspector / legend chip. */
  chip: string;
}

// Stroke weights are set for the DEFAULT zoom, not for 1:1. A layered map is
// three times wider than the panel it lives in, so it opens around 0.6× — where a
// 2.4px line renders at 1.5px and reads as a hairline. Everything here is roughly
// 40% heavier than looks right in isolation, which is what makes it look right on
// screen. Dash gaps follow the same logic.
export const EDGE_STYLES: Record<EdgeKind, EdgeStyle> = {
  primary: {
    name: "Normal step",
    meaning: "The intended route. Do these in order.",
    hex: "#0f172a",
    mutedHex: "#d5dce5",
    width: 3.4,
    chip: "border-slate-300 bg-slate-100 text-slate-700",
  },
  bypass: {
    name: "Fast track",
    meaning: "A legitimate shortcut — but only if your child can already prove it.",
    hex: "#7c3aed",
    mutedHex: "#ddd6fe",
    width: 3,
    dash: "11 8",
    chip: "border-violet-300 bg-violet-50 text-violet-700",
  },
  overreach: {
    name: "Open but not ready",
    meaning: "Nothing stops you entering. That isn't the same as belonging there.",
    hex: "#e11d48",
    mutedHex: "#fecdd3",
    width: 3.2,
    dash: "3.5 9",
    chip: "border-rose-300 bg-rose-50 text-rose-700",
  },
  offramp: {
    name: "Side route",
    meaning: "Leads to a different goal — often a better one than you expected.",
    hex: "#0284c7",
    mutedHex: "#bae6fd",
    width: 2.6,
    chip: "border-sky-300 bg-sky-50 text-sky-700",
  },
};

// ─── Node kinds ─────────────────────────────────────────────────────────────

export interface NodeStyle {
  /** Card shell classes when the node is in the active path. */
  shell: string;
  /** Card shell classes when dimmed. */
  muted: string;
  /** Icon tile classes. Only the start card styles its own — every other tile
   *  takes its colour from the lane tone. */
  tile: string;
  labelClass: string;
  subClass: string;
}

const CARD_SHELL =
  "border-slate-200/80 bg-white shadow-[0_4px_18px_-8px_rgba(15,23,42,0.18)] hover:shadow-[0_16px_34px_-14px_rgba(15,23,42,0.28)]";
const CARD_MUTED = "border-slate-100 bg-white/75 shadow-none";

// `stage` and `milestone` deliberately look identical. The distinction is real to
// the model but not to a parent — and the lane stripe already says which track a
// card belongs to, which is the thing they actually need from its colour.
export const NODE_STYLES: Record<NodeKind, NodeStyle> = {
  start: {
    shell:
      "border-slate-700 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-700 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.55)]",
    muted: "border-slate-300 bg-slate-700/70",
    tile: "bg-white/15 text-white",
    labelClass: "text-white",
    subClass: "text-slate-300",
  },
  stage: {
    shell: CARD_SHELL,
    muted: CARD_MUTED,
    tile: "",
    labelClass: "text-slate-900",
    subClass: "text-slate-500",
  },
  milestone: {
    shell: CARD_SHELL,
    muted: CARD_MUTED,
    tile: "",
    labelClass: "text-slate-900",
    subClass: "text-slate-500",
  },
  goal: {
    shell: "shadow-[0_6px_24px_-10px_rgba(15,23,42,0.28)]",
    muted: CARD_MUTED,
    tile: "",
    labelClass: "",
    subClass: "",
  },
};
