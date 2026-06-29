"use client";

import { UserCircle2, Target, Activity, Timer, Wallet, MapPin, Pencil } from "lucide-react";
import type { GuidanceFormState } from "../../types";
import type { Compass } from "lucide-react";

export function InputsSummaryBar({
  query,
  onEdit,
}: {
  query: GuidanceFormState;
  onEdit: () => void;
}) {
  const chips: Array<{ icon: typeof Compass; label: string }> = [
    { icon: UserCircle2, label: `Age ${query.child_age}` },
    { icon: Target, label: query.primary_objective },
    ...(query.sport?.trim() ? [{ icon: Activity, label: query.sport.trim() }] : []),
    { icon: Timer, label: `${query.weekly_time_commitment}h / week` },
    { icon: Wallet, label: query.budget_tier },
    ...(query.location ? [{ icon: MapPin, label: query.location }] : []),
  ];

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
      <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Built for
      </span>
      {chips.map((c) => (
        <span
          key={c.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
        >
          <c.icon className="h-3.5 w-3.5 text-slate-400" />
          {c.label}
        </span>
      ))}
      <button
        type="button"
        onClick={onEdit}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-power-orange/40 hover:text-power-orange"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit inputs
      </button>
    </div>
  );
}
