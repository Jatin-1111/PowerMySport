"use client";

const AGES = Array.from({ length: 15 }, (_, i) => i + 4); // 4–18

export function AgeGrid({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2.5">
      {AGES.map((age) => {
        const selected = value === age;
        return (
          <button
            key={age}
            type="button"
            onClick={() => onChange(age)}
            className={`h-14 rounded-2xl border-2 text-base font-bold transition-all duration-150 active:scale-95 ${
              selected
                ? "border-power-orange bg-power-orange text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {age}
          </button>
        );
      })}
    </div>
  );
}
