"use client";

import { motion } from "framer-motion";
import { Flag, TrendingUp } from "lucide-react";
import { slideIn } from "../../constants";
import type { GuidanceFormState, PlayerProfile } from "../../types";
import { SportMatchModal } from "./SportMatchModal";
import { useState } from "react";

interface LevelContext {
  sport: string;
  level: number;
  levelLabel: string;
}

export function Step1Profile({
  form,
  update,
  players,
  selectedId,
  onSelectPlayer,
  levelContext,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => void;
  players: PlayerProfile[];
  selectedId: string;
  onSelectPlayer: (id: string) => void;
  levelContext?: LevelContext;
}) {
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const alreadyAtLevel =
    !!levelContext && form.current_pathway_level === levelContext.level;

  const selectedPlayer = players.find((p) => p._id === selectedId);
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
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">
            Auto-fill from profile
          </p>
          <select
            value={selectedId}
            onChange={(e) => onSelectPlayer(e.target.value)}
            className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
              onChange={(e) =>
                update(
                  "child_age",
                  e.target.value ? Number(e.target.value) : ("" as any),
                )
              }
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
          Current Sport {levelContext ? "" : "(optional)"}
        </span>
        <input
          type="text"
          value={form.sport}
          onChange={(e) => update("sport", e.target.value)}
          disabled={!!levelContext}
          placeholder="e.g. Basketball, Swimming, Cricket…"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10 disabled:bg-slate-50 disabled:text-slate-500"
        />
        {levelContext && (
          <p className="text-[11px] text-slate-400">
            Locked — set from the {levelContext.levelLabel} level pathway you're
            exploring.
          </p>
        )}
      </div>

      <SportMatchModal
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        playerProfile={selectedPlayer}
        onExplore={(sportName) => {
          update("sport", sportName);
        }}
      />

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Experience (years){" "}
          <span className="text-slate-400 normal-case font-normal">
            (optional)
          </span>
        </span>
        <input
          type="number"
          min={0}
          max={20}
          step={0.5}
          value={form.years_playing ?? ""}
          onChange={(e) =>
            update(
              "years_playing",
              e.target.value ? Number(e.target.value) : undefined,
            )
          }
          placeholder="e.g. 1.5"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
        />
        <p className="text-[11px] text-slate-400">
          Leave blank if they haven't started yet.
        </p>
      </div>

      {levelContext && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Where does your child stand today?
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => update("current_pathway_level", undefined)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                !alreadyAtLevel
                  ? "border-power-orange bg-orange-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Flag
                className={`mt-0.5 h-4 w-4 shrink-0 ${!alreadyAtLevel ? "text-power-orange" : "text-slate-400"}`}
              />
              <span>
                <span
                  className={`block text-xs font-bold ${!alreadyAtLevel ? "text-power-orange" : "text-slate-800"}`}
                >
                  Not there yet
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  {levelContext.levelLabel} {levelContext.sport} would be new
                  for us
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                update("current_pathway_level", levelContext.level)
              }
              className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                alreadyAtLevel
                  ? "border-power-orange bg-orange-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <TrendingUp
                className={`mt-0.5 h-4 w-4 shrink-0 ${alreadyAtLevel ? "text-power-orange" : "text-slate-400"}`}
              />
              <span>
                <span
                  className={`block text-xs font-bold ${alreadyAtLevel ? "text-power-orange" : "text-slate-800"}`}
                >
                  Already here
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  My child already plays at {levelContext.levelLabel} level
                </span>
              </span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
