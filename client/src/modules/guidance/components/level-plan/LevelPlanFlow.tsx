"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, MapPin, Wallet, Trophy, Users } from "lucide-react";
import { motion } from "framer-motion";
import type { GuidanceFormState } from "../../types";
import { BUDGET_OPTIONS, INDIAN_STATES } from "../../constants";

const TRAINING_OPTIONS = [
  { label: "No training yet", value: "none", fitness: "Low" as const, hrs: 3 },
  { label: "School sports only", value: "school", fitness: "Low" as const, hrs: 4 },
  { label: "Some coaching", value: "coaching", fitness: "Moderate" as const, hrs: 5 },
  { label: "Already competing", value: "competing", fitness: "High" as const, hrs: 8 },
] as const;

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

  // Set defaults for fields not shown in this compact flow
  useEffect(() => {
    update("primary_objective", "Competitive");
    update("parent_specific_question",
      `We are exploring starting ${sport} at the ${levelLabel} level. Based on my child's profile, is this the right time to begin? What will the first 3 months realistically look like for our family, and what are the 3 most important first steps?`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, levelLabel]);

  const handleTraining = (opt: typeof TRAINING_OPTIONS[number]) => {
    setTrainingBg(opt.value);
    update("current_fitness_level", opt.fitness);
    update("weekly_time_commitment", opt.hrs);
  };

  const canSubmit = !loading && form.child_age >= 3 && form.child_age <= 21 && !!form.location;

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
          <p className="text-[10px] text-slate-400 font-medium">3 quick questions</p>
          <p className="text-xs font-semibold text-slate-600">then your decision guide</p>
        </div>
      </motion.div>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm sm:p-8 space-y-7"
      >
        {/* Age */}
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
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  trainingBg === opt.value
                    ? "border-power-orange bg-orange-50 text-power-orange"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <p className="text-xs font-semibold leading-snug">{opt.label}</p>
              </button>
            ))}
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
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    active
                      ? "border-power-orange bg-orange-50 text-power-orange"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              );
            })}
          </div>
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
            <><Loader2 className="h-4 w-4 animate-spin" /> Building your decision guide…</>
          ) : (
            <><Trophy className="h-4 w-4" /> Get my {levelLabel} plan</>
          )}
        </button>
      </motion.div>
    </div>
  );
}
