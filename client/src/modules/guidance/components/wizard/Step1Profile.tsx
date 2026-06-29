"use client";

import { motion } from "framer-motion";
import { slideIn } from "../../constants";
import type { GuidanceFormState, PlayerProfile } from "../../types";

export function Step1Profile({
  form,
  update,
  players,
  selectedId,
  onSelectPlayer,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => void;
  players: PlayerProfile[];
  selectedId: string;
  onSelectPlayer: (id: string) => void;
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
          Who are we building for?
        </h2>
        <p className="text-sm text-slate-500">
          Tell us about the young athlete.
        </p>
      </div>

      {players.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
            Auto-fill from profile
          </p>
          <select
            value={selectedId}
            onChange={(e) => onSelectPlayer(e.target.value)}
            className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">— New athlete —</option>
            {players.map((p) => (
              <option key={p._id} value={p._id}>
                {p.type === "SELF"
                  ? `Myself (${p.name})`
                  : `Dependent: ${p.name}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Age
          </span>
          <div className="relative">
            <input
              type="number"
              min={3}
              max={21}
              value={form.child_age || ""}
              onChange={(e) => update("child_age", e.target.value ? Number(e.target.value) : ("" as any))}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-10 text-lg font-bold text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
              yrs
            </span>
          </div>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Gender
          </span>
          <div className="flex gap-2 h-12">
            {(["male", "female"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => update("child_gender", g)}
                className={`flex-1 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                  form.child_gender === g
                    ? "border-power-orange bg-power-orange text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {g === "male" ? "♂ Male" : "♀ Female"}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Current Sport (optional)
        </span>
        <input
          type="text"
          value={form.sport}
          onChange={(e) => update("sport", e.target.value)}
          placeholder="e.g. Basketball, Swimming, Cricket…"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
        />
      </div>
    </motion.div>
  );
}
