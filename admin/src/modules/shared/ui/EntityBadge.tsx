import { cn } from "@/utils/cn";

interface EntityBadgeProps {
  name?: string | null;
  email?: string | null;
  fallbackLabel?: string;
  size?: "sm" | "md";
  className?: string;
}

const getInitial = (name: string): string =>
  name.trim().charAt(0).toUpperCase() || "?";

/**
 * Renders a resolved reference (name + optional email) consistently across
 * the admin panel. Degrades a genuinely-missing reference to a labeled
 * "Unresolved" chip instead of ever rendering a raw ObjectId.
 */
export function EntityBadge({
  name,
  email,
  fallbackLabel = "Unresolved",
  size = "md",
  className,
}: EntityBadgeProps) {
  const avatarSize = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  const nameSize = size === "sm" ? "text-xs" : "text-sm";
  const emailSize = size === "sm" ? "text-[11px]" : "text-xs";

  if (!name) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500",
          className,
        )}
        title="This reference could not be resolved to a record."
      >
        {fallbackLabel}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-power-orange/10 font-semibold text-power-orange",
          avatarSize,
        )}
        aria-hidden="true"
      >
        {getInitial(name)}
      </span>
      <div className="min-w-0">
        <p className={cn("truncate font-medium text-slate-900", nameSize)}>
          {name}
        </p>
        {email && (
          <p className={cn("truncate text-slate-500", emailSize)}>{email}</p>
        )}
      </div>
    </div>
  );
}
