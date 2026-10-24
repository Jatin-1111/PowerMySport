import { cn } from "@/utils/cn";
import { Inbox, RotateCw } from "lucide-react";
import type { ReactNode } from "react";

/** Grey placeholder shaped like the content that is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4", className)} />;
}

/** Block of skeleton lines for a loading section. Announces itself once. */
export function SkeletonBlock({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 py-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={i % 3 === 2 ? "w-2/3" : i % 3 === 1 ? "w-5/6" : "w-full"} />
      ))}
    </div>
  );
}

/** Nothing here yet. Say what is missing and, when there is one, what to do. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-sm flex-col items-center py-10 text-center", className)}>
      <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Inbox className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Inline failure with a way to try again. */
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
    >
      <p className="text-sm font-medium text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100"
        >
          <RotateCw size={14} aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}
