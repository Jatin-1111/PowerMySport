"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Sparkles,
  MapPin,
  Wallet,
  Trophy,
  Users,
  Clock,
  Heart,
  MessageCircleQuestion,
  Flag,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import type { GuidanceFormState } from "../../types";
import {
  BUDGET_OPTIONS,
  INDIAN_STATES,
  OBJECTIVES,
  PERSONALITY_OPTIONS,
} from "../../constants";

const TRAINING_OPTIONS = [
  { label: "No training yet", value: "none", fitness: "Low" as const },
  { label: "School sports only", value: "school", fitness: "Low" as const },
  { label: "Some coaching", value: "coaching", fitness: "Moderate" as const },
  { label: "Already competing", value: "competing", fitness: "High" as const },
] as const;

const TIME_OPTIONS = [
  { label: "2–3 hrs", desc: "Light start", hrs: 3 },
  { label: "4–6 hrs", desc: "A few sessions", hrs: 5 },
  { label: "7–10 hrs", desc: "Most days", hrs: 8 },
  { label: "10+ hrs", desc: "Serious training", hrs: 12 },
] as const;

// Distinct from TRAINING_OPTIONS: that captures the STYLE of training so
// far, this captures raw TIME already spent in the sport. A child can have
// played casually for 2 years with no formal coaching, or reach organised
// competition within months — the AI needs both signals separately (see
// "years_playing" usage in the guidance system prompt).
const EXPERIENCE_OPTIONS = [
  { label: "Never played", desc: "Would be their first time", years: 0 },
  { label: "A few months", desc: "Just getting started", years: 0.5 },
  { label: "About 1 year", desc: "Some real experience", years: 1 },
  { label: "2+ years", desc: "Well experienced", years: 2.5 },
] as const;

const MAX_PERSONALITY_TAGS = 3;

interface Props {
  sport: string;
  level: number;
  levelLabel: string;
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(k: K, v: GuidanceFormState[K]) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function LevelPlanFlow({ sport, level, levelLabel, form, update, onSubmit, loading }: Props) {
  const [trainingBg, setTrainingBg] = useState<string>("none");
  const [worry, setWorry] = useState("");
  // Whether the child is ALREADY playing at this exact pathway level, or
  // exploring starting here. This is the single most important signal for
  // the AI: it decides whether current_pathway_level is anchored to `level`
  // (so Phase 1 of the journey starts from "improve from here") or left
  // unset (so the plan assesses readiness to begin from scratch). Without
  // this, a parent whose child already competes at this level would get a
  // "should you start?" verdict for a level they're already playing at.
  const [alreadyAtLevel, setAlreadyAtLevel] = useState(false);

  // Make the pre-selected "No training yet" chip truthful (initialForm
  // defaults fitness to Moderate, which belongs to "Some coaching"), and
  // seed years_playing so the field is never silently missing from the payload.
  useEffect(() => {
    update("current_fitness_level", "Low");
    update("years_playing", 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    update("current_pathway_level", alreadyAtLevel ? level : undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyAtLevel, level]);

  // Compose the question the AI's goalAssessment answers: the level-plan
  // framing plus, when given, the parent's own words — so the verdict
  // addresses THEIR actual concern, not just our canned one.
  useEffect(() => {
    const base = alreadyAtLevel
      ? `My child is already playing ${sport} at the ${levelLabel} level. Based on their profile, what's realistic for us to focus on and achieve over the next 3 months, and what would tell us they're ready to progress to the next level?`
      : `We are exploring starting ${sport} at the ${levelLabel} level. Based on my child's profile, is this the right time to begin? What will the first 3 months realistically look like for our family, and what are the 3 most important first steps?`;
    const custom = worry.trim()
      ? ` My biggest question is: ${worry.trim()}`
      : "";
    update("parent_specific_question", `${base}${custom}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, levelLabel, worry, alreadyAtLevel]);

  const handleTraining = (opt: (typeof TRAINING_OPTIONS)[number]) => {
    setTrainingBg(opt.value);
    update("current_fitness_level", opt.fitness);
  };

  const togglePersonality = (label: string) => {
    const tags = form.personality_tags || [];
    if (tags.includes(label)) {
      update("personality_tags", tags.filter((t) => t !== label));
    } else if (tags.length < MAX_PERSONALITY_TAGS) {
      update("personality_tags", [...tags, label]);
    }
  };

  const canSubmit = !loading && form.child_age >= 3 && form.child_age <= 21 && !!form.location;

  const chipCls = (active: boolean) =>
    `rounded-xl border px-3 py-3 text-left transition-all ${
      active
        ? "border-power-orange bg-orange-50 text-power-orange"
        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-4 mx-auto max-w-4xl">
      {/* Context banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-2xl border border-orange-100 bg-orange-50/80 px-5 py-4"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-power-orange/15">
          <Sparkles className="h-5 w-5 text-power-orange" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-power-orange/70">
            Planning for
          </p>
          <p className="font-title font-bold text-slate-900 truncate">
            {sport} · {levelLabel} Level
          </p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-[10px] text-slate-400 font-medium">2 minutes</p>
          <p className="text-xs font-semibold text-slate-600">then your personalised plan</p>
        </div>
      </motion.div>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm sm:p-8 space-y-7"
      >
        {/* Already-there vs starting-out — the single most important signal;
            it changes what kind of plan gets built, not just the wording. */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-3">
            Where does your child stand today?
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setAlreadyAtLevel(false)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                !alreadyAtLevel
                  ? "border-power-orange bg-orange-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Flag className={`mt-0.5 h-4 w-4 shrink-0 ${!alreadyAtLevel ? "text-power-orange" : "text-slate-400"}`} />
              <span>
                <span className={`block text-xs font-bold ${!alreadyAtLevel ? "text-power-orange" : "text-slate-800"}`}>
                  Not there yet
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  {levelLabel} {sport} would be new for us
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAlreadyAtLevel(true)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                alreadyAtLevel
                  ? "border-power-orange bg-orange-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <TrendingUp className={`mt-0.5 h-4 w-4 shrink-0 ${alreadyAtLevel ? "text-power-orange" : "text-slate-400"}`} />
              <span>
                <span className={`block text-xs font-bold ${alreadyAtLevel ? "text-power-orange" : "text-slate-800"}`}>
                  Already here
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  My child already plays at {levelLabel} level
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* ── About your child ── */}
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
            About your child
          </p>
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        {/* Age + gender */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-3">
              <Users className="inline h-3.5 w-3.5 mr-1.5 text-slate-400" />
              How old is your child?
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={3}
                max={21}
                value={form.child_age}
                onChange={(e) => update("child_age", Number(e.target.value))}
                className="flex-1 accent-[var(--color-power-orange,theme(colors.orange.500))]"
              />
              <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl border border-power-orange/30 bg-orange-50 text-2xl font-extrabold text-power-orange tabular-nums">
                {form.child_age}
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-0.5">
              <span>3 yrs</span><span>21 yrs</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-3">Child is a</label>
            <div className="grid grid-cols-2 gap-2 sm:w-44">
              {([
                { value: "male", label: "Boy" },
                { value: "female", label: "Girl" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("child_gender", opt.value)}
                  className={chipCls(form.child_gender === opt.value)}
                >
                  <p className="text-xs font-semibold text-center">{opt.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Training background */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-3">
            Current training background
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TRAINING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleTraining(opt)}
                className={chipCls(trainingBg === opt.value)}
              >
                <p className="text-xs font-semibold leading-snug">{opt.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Experience duration */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-3">
            How long has your child been playing {sport}?
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.years}
                type="button"
                onClick={() => update("years_playing", opt.years)}
                className={chipCls(form.years_playing === opt.years)}
              >
                <p className="text-xs font-bold">{opt.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Personality */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-1">
            <Heart className="inline h-3.5 w-3.5 mr-1.5 text-slate-400" />
            What is your child like?
          </label>
          <p className="text-[11px] text-slate-400 mb-3">
            Pick up to {MAX_PERSONALITY_TAGS} — this shapes the coaching style we recommend
          </p>
          <div className="flex flex-wrap gap-2">
            {PERSONALITY_OPTIONS.map((opt) => {
              const active = (form.personality_tags || []).includes(opt.label);
              const full = !active && (form.personality_tags || []).length >= MAX_PERSONALITY_TAGS;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => togglePersonality(opt.label)}
                  disabled={full}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all disabled:opacity-40 ${
                    active
                      ? "border-power-orange bg-orange-50 text-power-orange"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Your plan ── */}
        <div className="flex items-center gap-3 pt-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
            Your plan
          </p>
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        {/* Main goal */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-3">
            <Trophy className="inline h-3.5 w-3.5 mr-1.5 text-slate-400" />
            What do you mainly want from {sport}?
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OBJECTIVES.map((opt) => {
              const active = form.primary_objective === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("primary_objective", opt.value)}
                  className={chipCls(active)}
                >
                  <opt.icon className={`h-4 w-4 mb-1.5 ${active ? "text-power-orange" : "text-slate-400"}`} />
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Weekly time */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-3">
            <Clock className="inline h-3.5 w-3.5 mr-1.5 text-slate-400" />
            Time available for sport each week
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIME_OPTIONS.map((opt) => {
              const active = form.weekly_time_commitment === opt.hrs;
              return (
                <button
                  key={opt.hrs}
                  type="button"
                  onClick={() => update("weekly_time_commitment", opt.hrs)}
                  className={chipCls(active)}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-3">
            <MapPin className="inline h-3.5 w-3.5 mr-1.5 text-slate-400" />
            Your state / location
            <span className="text-power-orange ml-1">*</span>
          </label>
          <select
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-power-orange transition"
          >
            <option value="">Select your state…</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-3">
            <Wallet className="inline h-3.5 w-3.5 mr-1.5 text-slate-400" />
            Monthly budget for sports
          </label>
          <div className="grid grid-cols-3 gap-2">
            {BUDGET_OPTIONS.map((opt) => {
              const active = form.budget_tier === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("budget_tier", opt.value)}
                  className={chipCls(active)}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parent's own question (optional) */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-1">
            <MessageCircleQuestion className="inline h-3.5 w-3.5 mr-1.5 text-slate-400" />
            Anything specific on your mind?
            <span className="ml-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Optional</span>
          </label>
          <p className="text-[11px] text-slate-400 mb-3">
            e.g. "Board exams are next year — can we still start?" — your plan will answer it directly
          </p>
          <textarea
            rows={2}
            maxLength={400}
            value={worry}
            onChange={(e) => setWorry(e.target.value)}
            placeholder="Your biggest question or worry about starting…"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-power-orange transition"
          />
        </div>

        {/* Submit */}
        {!form.location && (
          <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
            Please select your state to continue
          </p>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-power-orange px-5 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.5)] transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Building your personalised plan…</>
          ) : (
            <><Trophy className="h-4 w-4" /> Get my {levelLabel} plan</>
          )}
        </button>
      </motion.div>
    </div>
  );
}
