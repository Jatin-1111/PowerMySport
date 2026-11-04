"use client";

interface Option {
  value: string;
  title: string;
  sub: string;
}

export function BinaryCards({
  options,
  value,
  onChange,
}: {
  options: [Option, Option];
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
              className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                selected ? "bg-power-orange" : "bg-slate-100"
              }`}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  selected ? "bg-white" : "bg-slate-400"
                }`}
              />
            </div>
            <p
              className={`mb-1.5 text-[15px] font-semibold leading-snug ${
                selected ? "text-power-orange" : "text-slate-900"
              }`}
            >
              {opt.title}
            </p>
            <p
              className={`text-sm leading-relaxed ${
                selected ? "text-power-orange/70" : "text-slate-500"
              }`}
            >
              {opt.sub}
            </p>
          </button>
        );
      })}
    </div>
  );
}
