"use client";

export function SpectrumSlider({
  value,
  onChange,
  leftLabel,
  rightLabel,
  leftExamples,
  rightExamples,
}: {
  value: number | null;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  leftExamples: string;
  rightExamples: string;
}) {
  const current = value ?? 3;

  const labels: Record<number, string> = {
    1: "Solo",
    2: "Mostly solo",
    3: "Balanced",
    4: "Mostly team",
    5: "Team",
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-widest">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((tick) => {
          const selected = current === tick;
          return (
            <button
              key={tick}
              type="button"
              onClick={() => onChange(tick)}
              className={`rounded-2xl py-5 flex flex-col items-center gap-2 border-2 transition-all duration-150 active:scale-[0.97] ${
                selected
                  ? "border-power-orange bg-power-orange text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`text-xl font-bold tabular-nums ${
                  selected ? "text-white" : "text-slate-600"
                }`}
              >
                {tick}
              </span>
              <span
                className={`text-[10px] font-medium leading-none text-center ${
                  selected ? "text-white/80" : "text-slate-400"
                }`}
              >
                {labels[tick]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-slate-400 leading-snug">
        <span className="max-w-[140px]">{leftExamples}</span>
        <span className="max-w-[140px] text-right">{rightExamples}</span>
      </div>
    </div>
  );
}
