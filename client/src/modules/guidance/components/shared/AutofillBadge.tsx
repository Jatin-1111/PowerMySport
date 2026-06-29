"use client";

import { CheckCheck } from "lucide-react";

export function AutofillBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-700 ml-2">
      <CheckCheck className="h-2.5 w-2.5" /> From profile
    </span>
  );
}
