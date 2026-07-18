"use client";

// A textarea paired with toggleable suggestion chips. Selecting a chip
// appends its exact text to the textarea (one per line); deselecting removes
// that exact line. A chip's selected state is derived from whether its text
// is currently present — not a separate boolean — so it stays in sync even
// if the parent hand-edits the text (adds/removes a suggested line manually,
// or edits their own free-typed lines without touching a suggestion).

function linesOf(value: string): string[] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function TagAssistedTextarea({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const currentLines = linesOf(value);
  const isSelected = (chip: string) => currentLines.includes(chip);

  const toggleChip = (chip: string) => {
    if (isSelected(chip)) {
      onChange(currentLines.filter((l) => l !== chip).join("\n"));
    } else {
      onChange([...currentLines, chip].join("\n"));
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {options.map((chip) => {
          const selected = isSelected(chip);
          return (
            <button
              key={chip}
              type="button"
              onClick={() => toggleChip(chip)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selected
                  ? "border-power-orange bg-orange-50 text-power-orange"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {selected ? "− " : "+ "}
              {chip}
            </button>
          );
        })}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Tap a common issue above, or describe it in your own words — one point per line."}
        rows={5}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20 resize-none leading-relaxed"
      />
    </div>
  );
}
