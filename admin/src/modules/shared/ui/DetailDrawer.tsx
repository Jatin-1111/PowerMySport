"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { cn } from "@/utils/cn";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Rendered on the right of the header (e.g. a status badge). */
  headerExtra?: ReactNode;
  /** Sticky footer, e.g. action buttons. */
  footer?: ReactNode;
  children: ReactNode;
  widthClass?: string;
}

/**
 * Right-anchored slide-out panel for viewing a single record's full detail.
 * Shared across the admin list pages so every "row → detail" interaction
 * looks and behaves the same. Closes on backdrop click or Escape, and locks
 * body scroll while open.
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  headerExtra,
  footer,
  children,
  widthClass = "max-w-lg",
}: DetailDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex h-full w-full flex-col bg-white shadow-2xl",
          widthClass,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="text-lg font-bold text-slate-900">{title}</div>
            {subtitle && (
              <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {children}
        </div>

        {footer && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Titled group of detail rows.
 */
export function DetailSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/**
 * A single label/value line inside a DetailSection.
 */
export function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 text-sm",
        className,
      )}
    >
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-slate-900">
        {value ?? "—"}
      </span>
    </div>
  );
}
