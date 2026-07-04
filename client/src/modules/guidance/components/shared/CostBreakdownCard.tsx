"use client";

import { UserCircle2, Dumbbell, Trophy, Wallet } from "lucide-react";
import type { CostBreakdown } from "../../types";

export function CostBreakdownCard({ c }: { c: CostBreakdown }) {
  const items = [
    { icon: UserCircle2, label: "Coaching", value: c.monthlyCoaching },
    { icon: Dumbbell, label: "Equipment", value: c.equipment },
    { icon: Trophy, label: "Tournaments", value: c.tournaments },
  ];
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-emerald-600" />
        <h3 className="font-title text-sm font-semibold uppercase tracking-wide text-slate-900">
          Investment
        </h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
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
