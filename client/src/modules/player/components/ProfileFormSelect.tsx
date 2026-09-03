import { cn } from "@/utils/cn";
import { ChevronDown } from "lucide-react";

type ProfileFormSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  disabled?: boolean;
};

export function ProfileFormSelect({
  id,
  value,
  onChange,
  options,
  className,
  disabled = false,
}: ProfileFormSelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={cn(
          "border-input ring-offset-background focus-visible:ring-power-orange h-10 w-full appearance-none rounded-md border bg-white px-3 py-2 pr-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}
