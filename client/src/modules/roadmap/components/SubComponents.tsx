"use client";



// ─── Sub-components ───────────────────────────────────────────────────────────

export function AmbientBlob({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl will-change-transform ${className}`}
    />
  );
}

export const levelColorMap: Record<
  number,
  { gradient: string; bg: string; border: string; text: string; badge: string }
> = {
  1: {
    gradient: "from-emerald-500 to-teal-500",
    bg: "from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  2: {
    gradient: "from-blue-500 to-indigo-500",
    bg: "from-blue-50 to-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  3: {
    gradient: "from-violet-500 to-purple-600",
    bg: "from-violet-50 to-purple-50",
    border: "border-indigo-200",
    text: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  4: {
    gradient: "from-orange-500 to-amber-500",
    bg: "from-orange-50 to-amber-50",
    border: "border-orange-200",
    text: "text-orange-600",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
  5: {
    gradient: "from-rose-500 to-pink-600",
    bg: "from-rose-50 to-pink-50",
    border: "border-rose-200",
    text: "text-rose-600",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
  },
};

