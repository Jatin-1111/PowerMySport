"use client";

import { motion } from "framer-motion";
import { UserRound } from "lucide-react";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { slideIn } from "../../constants";
import type { GuidanceFormState } from "../../types";

export function Step1ParentInfo({
  form,
  update,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(k: K, v: GuidanceFormState[K]) => void;
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
          A little about you
        </h2>
        <p className="text-sm text-slate-500">
          Optional — helps the AI understand your perspective as a parent.
        </p>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <UserRound className="h-3.5 w-3.5" />
          Your background
          <span className="normal-case font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          rows={3}
          maxLength={300}
          value={form.parent_bio ?? ""}
          onChange={(e) => update("parent_bio", e.target.value)}
          placeholder="e.g., Former club cricketer, now focused on my daughter's tennis journey."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10 resize-none"
        />
        <p className="text-[10px] text-slate-400 text-right">{(form.parent_bio ?? "").length}/300</p>
      </div>

      {/* Sport interest */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Sports you follow most closely
          <span className="ml-1 normal-case font-normal text-slate-400">(optional)</span>
        </label>
        <SportsMultiSelect
          value={form.parent_sport_interest ?? []}
          onChange={(sports) => update("parent_sport_interest", sports)}
        />
      </div>

      {/* Involvement years */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="parent-involvement">
          Years involved or interested in sport
          <span className="ml-1 normal-case font-normal text-slate-400">(optional)</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            id="parent-involvement"
            type="number"
            min={0}
            max={40}
            value={form.parent_involvement_years ?? ""}
            onChange={(e) =>
              update(
                "parent_involvement_years",
                e.target.value === "" ? undefined : Math.min(40, parseInt(e.target.value, 10) || 0),
              )
            }
            placeholder="e.g., 5"
            className="w-28 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
          />
          <span className="text-sm text-slate-500">years</span>
        </div>
      </div>
    </motion.div>
  );
}
