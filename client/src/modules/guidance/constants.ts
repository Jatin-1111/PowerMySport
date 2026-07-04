// ─── Guidance Module Constants & Utilities ───────────────────────────────────

import {
  Shield,
  Zap,
  Trophy,
  Users,
  Crosshair,
  Compass,
  Timer,
  Network,
  Smile,
  Activity,
  Target,
  Sprout,
  Flame,
  Wallet,
  CreditCard,
  Diamond,
  UserCircle2,
  Sparkles,
} from "lucide-react";
import type { Variants } from "framer-motion";
import type { GuidanceFormState } from "./types";

export const PERSONALITY_OPTIONS = [
  { label: "Shy", icon: Shield },
  { label: "Energetic", icon: Zap },
  { label: "Competitive", icon: Trophy },
  { label: "Social", icon: Users },
  { label: "Focused", icon: Crosshair },
  { label: "Curious", icon: Compass },
  { label: "Patient", icon: Timer },
  { label: "Team-oriented", icon: Network },
] as const;

export const OBJECTIVES = [
  {
    value: "Recreational",
    label: "Just for Fun",
    icon: Smile,
    desc: "Play and enjoy sport casually",
  },
  {
    value: "Fitness",
    label: "Get Fit",
    icon: Activity,
    desc: "Build strength and stamina",
  },
  { value: "Compete", label: "Compete", icon: Trophy, desc: "Train to win" },
  { value: "Elite", label: "Reach Next Level", icon: Diamond, desc: "Take performance to the highest level" },
] as const;

export const FITNESS_LEVELS = [
  {
    value: "Low",
    label: "Beginner",
    icon: Sprout,
    color: "text-emerald-600",
    bar: "w-1/3",
    barColor: "bg-emerald-400",
    desc: "Just starting out",
  },
  {
    value: "Moderate",
    label: "Developing",
    icon: Flame,
    color: "text-amber-600",
    bar: "w-2/3",
    barColor: "bg-amber-400",
    desc: "Some experience",
  },
  {
    value: "High",
    label: "Advanced",
    icon: Zap,
    color: "text-violet-600",
    bar: "w-full",
    barColor: "bg-violet-500",
    desc: "Skilled & active",
  },
] as const;

export const BUDGET_OPTIONS = [
  {
    value: "Budget",
    label: "Budget",
    icon: Wallet,
    desc: "Cost-effective choices",
  },
  {
    value: "Moderate",
    label: "Moderate",
    icon: CreditCard,
    desc: "Quality balanced",
  },
  {
    value: "Premium",
    label: "Premium",
    icon: Diamond,
    desc: "Best of everything",
  },
] as const;

export const STEPS = [
  { id: 1, label: "Profile", icon: UserCircle2 },
  { id: 2, label: "Goals", icon: Target },
  { id: 3, label: "Lifestyle", icon: Activity },
  { id: 4, label: "Details", icon: Sparkles },
] as const;

export const initialForm: GuidanceFormState = {
  child_age: 8,
  child_gender: "male",
  current_fitness_level: "Moderate",
  personality_tags: [],
  primary_objective: "Recreational",
  weekly_time_commitment: 3,
  budget_tier: "Moderate",
  parent_specific_question: "",
  sport: "",
  location: "",
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Chandigarh", "Puducherry",
].sort((a, b) => a.localeCompare(b));

// Required fields that must be filled before generating
export const REQUIRED_FIELDS: Array<{ key: keyof GuidanceFormState; label: string }> = [
  { key: "child_age", label: "Child's age" },
  { key: "child_gender", label: "Gender" },
  { key: "primary_objective", label: "Primary goal" },
  { key: "location", label: "State / Location" },
];

export function isFormValid(form: GuidanceFormState): boolean {
  return (
    form.child_age >= 3 &&
    form.child_age <= 21 &&
    !!form.child_gender &&
    !!form.primary_objective &&
    !!form.location
  );
}

// Templated parent_specific_question for the roadmap-entry ("level plan") flow —
// pre-fills Step4's free-text field so the AI's goalAssessment answers the
// level-plan framing directly instead of the parent having to phrase it.
export function buildLevelPlanQuestion(
  sport: string,
  levelLabel: string,
  alreadyAtLevel: boolean,
): string {
  return alreadyAtLevel
    ? `My child is already playing ${sport} at the ${levelLabel} level. Based on their profile, what's realistic for us to focus on and achieve over the next 3 months, and what would tell us they're ready to progress to the next level?`
    : `We are exploring starting ${sport} at the ${levelLabel} level. Based on my child's profile, is this the right time to begin? What will the first 3 months realistically look like for our family, and what are the 3 most important first steps?`;
}

export function getMissingFields(form: GuidanceFormState): string[] {
  const missing: string[] = [];
  if (!form.child_age || form.child_age < 3 || form.child_age > 21) missing.push("Child's age (3–21)");
  if (!form.child_gender) missing.push("Gender");
  if (!form.primary_objective) missing.push("Primary goal");
  if (!form.location) missing.push("State / Location");
  return missing;
}

// ─── Animations ───────────────────────────────────────────────────────────────

export const slideIn: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 340, damping: 28 },
  },
  exit: { opacity: 0, x: -30, transition: { duration: 0.15 } },
};

// Luxury easing — slow-out cubic used by premium editorial sites
export const LUXE_EASE = [0.22, 1, 0.36, 1] as const;
