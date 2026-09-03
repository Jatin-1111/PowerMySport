"use client";

interface Option {
  value: string;
  label: string;
}

export function ThreeOptionCards({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt, idx) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-150 active:scale-[0.99] ${
              selected
                ? "border-power-orange bg-power-orange/5 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
            }`}
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${
                selected ? "bg-power-orange text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {idx + 1}
            </div>
            <p
              className={`text-sm leading-relaxed ${
                selected ? "text-power-orange font-medium" : "text-slate-700"
              }`}
            >
              {opt.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
