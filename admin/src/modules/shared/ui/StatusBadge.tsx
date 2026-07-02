import { cn } from "@/utils/cn";

export type StatusTone =
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "slate"
  | "purple"
  | "orange";

const toneClasses: Record<StatusTone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
  orange: "bg-power-orange/10 text-power-orange ring-power-orange/20",
};

const dotClasses: Record<StatusTone, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  slate: "bg-slate-400",
  purple: "bg-purple-500",
  orange: "bg-power-orange",
};

/**
 * Central mapping of the platform's status strings → a semantic colour.
 * Covers booking, verification, approval and payment statuses so every admin
 * surface renders the same status the same way. Unknown values fall back to
 * a neutral slate tone rather than mis-signalling.
 */
const STATUS_TONE: Record<string, StatusTone> = {
  // Booking lifecycle
  CONFIRMED: "green",
  COMPLETED: "green",
  IN_PROGRESS: "blue",
  PENDING: "amber",
  PENDING_CONFIRMATION: "amber",
  PENDING_INVITES: "amber",
  PENDING_PAYMENT: "amber",
  CANCELLED: "red",
  NO_SHOW: "red",
  // Verification / approval
  VERIFIED: "green",
  APPROVED: "green",
  REVIEW: "blue",
  REJECTED: "red",
  UNVERIFIED: "slate",
  // Payment
  PAID: "green",
  CAPTURED: "green",
  FAILED: "red",
  REFUNDED: "purple",
  REFUND_INITIATED: "amber",
  REFUND_PENDING: "amber",
};

interface StatusBadgeProps {
  status?: string | null;
  /** Override the auto-resolved tone. */
  tone?: StatusTone;
  /** Show a leading status dot. Defaults to true. */
  dot?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Semantic, colour-coded status pill used across all admin list/detail views.
 * Pass a raw status string (e.g. "PENDING_CONFIRMATION") and it renders a
 * human-readable, consistently-coloured badge.
 */
export function StatusBadge({
  status,
  tone,
  dot = true,
  size = "md",
  className,
}: StatusBadgeProps) {
  const key = (status ?? "").toUpperCase();
  const resolvedTone = tone ?? STATUS_TONE[key] ?? "slate";
  const label = status ? status.replace(/_/g, " ") : "—";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        toneClasses[resolvedTone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotClasses[resolvedTone])}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
