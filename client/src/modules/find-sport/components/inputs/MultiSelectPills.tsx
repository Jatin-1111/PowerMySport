"use client";

export function MultiSelectPills({
  options,
  selected,
  onChange,
  noneLabel = "None yet",
  max,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  noneLabel?: string;
  /** When set, caps how many options can be picked and shows a counter. */
  max?: number;
}) {
  const atLimit = max !== undefined && selected.length >= max;

  const toggle = (opt: string) => {
    if (opt === "__none__") {
      onChange([]);
      return;
    }
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
      return;
    }
    if (atLimit) return;
    onChange([...selected, opt]);
  };

  const noneSelected = selected.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex max-h-[calc(100vh-340px)] flex-wrap gap-2 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => toggle("__none__")}
          className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all duration-150 ${
            noneSelected
              ? "border-power-orange bg-power-orange/5 text-power-orange"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          {noneLabel}
        </button>
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          // Unselected pills go quiet once the cap is reached — the limit reads
          // as a rule of the question, not as a failed click.
          const locked = !isSelected && atLimit;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              disabled={locked}
              className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all duration-150 ${
                isSelected
                  ? "border-power-orange bg-power-orange/5 text-power-orange"
                  : locked
                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {max !== undefined && (
        <p className="text-xs text-slate-400">
          {selected.length} of {max} selected
          {atLimit && " — deselect one to swap"}
        </p>
      )}
    </div>
  );
}
