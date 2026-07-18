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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`w-full text-left rounded-2xl border-2 p-5 transition-all duration-150 active:scale-[0.98] flex flex-col ${
              selected
                ? "border-power-orange bg-power-orange/5 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mb-3 transition-colors ${
                selected ? "bg-power-orange" : "bg-slate-300"
              }`}
            />
            <p
              className={`font-semibold text-[15px] mb-1 leading-snug ${
                selected ? "text-power-orange" : "text-slate-900"
              }`}
            >
              {opt.label}
            </p>
            <p
              className={`text-xs leading-relaxed mt-0.5 ${
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
