import { cn } from "@/utils/cn";
import type { StatusTone } from "../types";

const TONES: Record<StatusTone, string> = {
  neutral: "border-hairline bg-paper-deep text-ink-body",
  pending: "border-amber-300 bg-amber-50 text-amber-900",
  live: "border-green-700/25 bg-green-50 text-green-800",
  alert: "border-red-700/25 bg-red-50 text-red-800",
};

/** Square tag, not a pill. The word carries the meaning; colour only reinforces it. */
export function StatusTag({ tone, children }: { tone: StatusTone; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-sm font-medium",
        TONES[tone]
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
