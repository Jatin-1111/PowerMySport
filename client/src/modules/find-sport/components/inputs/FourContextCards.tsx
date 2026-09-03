"use client";

interface Option {
  value: string;
  label: string;
  context: string;
}

export function FourContextCards({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex w-full flex-col rounded-2xl border-2 p-5 text-left transition-all duration-150 active:scale-[0.98] ${
              selected
                ? "border-power-orange bg-power-orange/5 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div
              className={`mb-3 h-2 w-2 rounded-full transition-colors ${
                selected ? "bg-power-orange" : "bg-slate-300"
              }`}
            />
            <p
              className={`mb-1 text-[15px] leading-snug font-semibold ${
                selected ? "text-power-orange" : "text-slate-900"
              }`}
            >
              {opt.label}
            </p>
            <p
              className={`mt-0.5 text-xs leading-relaxed ${
                selected ? "text-power-orange/70" : "text-slate-400"
              }`}
            >
              {opt.context}
            </p>
          </button>
        );
      })}
    </div>
  );
}
