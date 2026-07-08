"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { FITNESS_LEVELS, OBJECTIVES, slideIn } from "../../constants";
import type { GuidanceFormState } from "../../types";
import { SelectCard } from "../shared/SelectCard";

export function Step2Goals({
  form,
  update,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => void;
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
          What's the main goal?
        </h2>
        <p className="text-sm text-slate-500">
          Choose the primary objective for this athlete.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OBJECTIVES.map((obj) => (
          <SelectCard
            key={obj.value}
            selected={form.primary_objective === obj.value}
            onClick={() => update("primary_objective", obj.value)}
            accent
          >
            <div className="flex items-start gap-3">
              <div className="text-slate-700 mt-1">
                <obj.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">{obj.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{obj.desc}</p>
              </div>
              {form.primary_objective === obj.value && (
                <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-power-orange" />
              )}
            </div>
          </SelectCard>
        ))}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Fitness Level
        </span>
        <div className="space-y-2">
          {FITNESS_LEVELS.map((lvl) => (
            <SelectCard
              key={lvl.value}
              selected={form.current_fitness_level === lvl.value}
              onClick={() => update("current_fitness_level", lvl.value)}
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-700">
                  <lvl.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800 text-sm">
                      {lvl.label}
                    </span>
                    <span className="text-xs text-slate-500">{lvl.desc}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${lvl.barColor} ${lvl.bar}`}
                    />
                  </div>
                </div>
                {form.current_fitness_level === lvl.value && (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-power-orange" />
                )}
              </div>
            </SelectCard>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
