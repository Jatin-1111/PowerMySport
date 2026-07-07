"use client";

import { Dumbbell, Trophy, UserCircle2, Wallet } from "lucide-react";
import type { CostBreakdown } from "../../types";

export function CostBreakdownCard({ c }: { c: CostBreakdown }) {
  const items = [
    { icon: UserCircle2, label: "Coaching", value: c.monthlyCoaching },
    { icon: Dumbbell, label: "Equipment", value: c.equipment },
    { icon: Trophy, label: "Tournaments", value: c.tournaments },
  ];
  return (
    <div className="rounded-3xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <Wallet className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-title text-lg font-bold text-slate-900 leading-tight">
              Investment Estimate
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Expected costs for this phase
            </p>
          </div>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Indicative
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
          >
            <Icon className="h-4 w-4 text-slate-400" />
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {label}
            </p>
            <p className="text-sm font-bold text-slate-800">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
