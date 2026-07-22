"use client";

export function MultiSelectPills({
  options,
  selected,
  onChange,
  noneLabel = "None yet",
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  noneLabel?: string;
}) {
  const toggle = (opt: string) => {
    if (opt === "__none__") {
      onChange([]);
      return;
    }
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onChange(next);
  };

  const noneSelected = selected.length === 0;

  return (
    <div className="flex flex-wrap gap-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
      <button
        type="button"
        onClick={() => toggle("__none__")}
        className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all duration-150 ${
          noneSelected
            ? "border-power-orange bg-power-orange/5 text-power-orange"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
        }`}
      >
        {noneLabel}
      </button>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all duration-150 ${
              isSelected
                ? "border-power-orange bg-power-orange/5 text-power-orange"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
