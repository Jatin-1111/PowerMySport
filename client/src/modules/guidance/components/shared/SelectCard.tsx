"use client";

export function SelectCard({
  selected,
  onClick,
  children,
  accent = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.99] ${
        selected
          ? accent
            ? "border-power-orange bg-power-orange/5 shadow-power-orange/10 shadow-lg"
            : "border-power-orange bg-power-orange/5"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
      }`}
    >
      {children}
    </button>
  );
}
