"use client";

import { motion } from "framer-motion";
import { CheckCircle2, MapPin } from "lucide-react";
import { BUDGET_OPTIONS, INDIAN_STATES, slideIn } from "../../constants";
import type { GuidanceFormState } from "../../types";
import { SelectCard } from "../shared/SelectCard";

export function Step3Lifestyle({
  form,
  update,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => void;
  autofillFields: Set<string>;
}) {
  return (
    <motion.div
      variants={slideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <div>
        <h2 className="font-title text-2xl font-bold text-slate-900 mb-1">
          Time, budget & location
        </h2>
        <p className="text-sm text-slate-500">
          Help us build a realistic, region-specific plan.
        </p>
      </div>

      {/* State / Location — required for govt scheme recommendations */}
      <div className="space-y-2">
        <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
          State / Union Territory
          <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-600">
            Required
          </span>
          <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
            For local schemes & resources
          </span>
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <select
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            className={`h-12 w-full rounded-xl border pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition appearance-none ${
              form.location
                ? "border-emerald-300 bg-emerald-50/40 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                : "border-slate-200 bg-white focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
            }`}
          >
            <option value="">— Select your state —</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {form.location && (
          <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> We'll include schemes and
            resources available in {form.location}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Weekly hours available
          </span>
          <span className="text-2xl font-bold text-power-orange tabular-nums">
            {form.weekly_time_commitment}h
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          step={1}
          value={form.weekly_time_commitment}
          onChange={(e) =>
            update("weekly_time_commitment", Number(e.target.value))
          }
          className="w-full accent-power-orange h-2 rounded-full cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
          <span>1h / week</span>
          <span>30h / week</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {[3, 8, 15].map((hrs) => (
            <button
              key={hrs}
              type="button"
              onClick={() => update("weekly_time_commitment", hrs)}
              className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                form.weekly_time_commitment === hrs
                  ? "bg-power-orange text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {hrs}h
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Budget tier
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {BUDGET_OPTIONS.map((b) => (
            <SelectCard
              key={b.value}
              selected={form.budget_tier === b.value}
              onClick={() => update("budget_tier", b.value)}
            >
              <div className="text-center py-1 flex flex-col items-center">
                <div className="mb-2 text-slate-700">
                  <b.icon className="h-6 w-6" />
                </div>
                <p className="font-bold text-slate-900 text-sm">{b.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{b.desc}</p>
              </div>
            </SelectCard>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
