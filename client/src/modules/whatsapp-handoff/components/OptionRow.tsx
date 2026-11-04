import { cn } from "@/utils/cn";

interface OptionRowProps<T extends string> {
  label: string;
  hint?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}

/**
 * One choice from a short fixed list, as buttons. Pressing the chosen one again clears it, so
 * a suggestion the parent does not agree with can be taken back to "not set".
 */
export function OptionRow<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: OptionRowProps<T>) {
  return (
    <div role="group" aria-label={label} className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700">
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-slate-500">{hint}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? undefined : option.value)}
              className={cn(
                "focus-visible:ring-ink rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                selected
                  ? "bg-ink border-ink text-white"
                  : "border-ink/25 text-ink hover:border-ink/40 hover:bg-paper-deep bg-white"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
