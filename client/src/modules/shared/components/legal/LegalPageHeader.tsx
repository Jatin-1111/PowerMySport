import type { LucideIcon } from "lucide-react";

interface LegalPageHeaderProps {
  icon: LucideIcon;
  title: string;
  lastUpdated: string;
  effective?: string;
}

/**
 * Shared hero header for legal/policy pages (Terms, Privacy, Refund Policy,
 * Content Policy). Keeps the gradient-card treatment identical across every
 * legal document instead of each page hand-rolling its own copy.
 */
export function LegalPageHeader({
  icon: Icon,
  title,
  lastUpdated,
  effective,
}: LegalPageHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
          <div className="relative z-10">
            <div className="mb-2 flex items-center gap-3">
              <Icon size={32} className="text-power-orange" />
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/80 uppercase">
                Legal
              </span>
            </div>
            <h1 className="font-title mb-3 text-3xl font-bold sm:text-4xl">{title}</h1>
            <p className="max-w-2xl text-base text-slate-200 sm:text-lg">
              Last updated: {lastUpdated}
              {effective ? ` | Effective: ${effective}` : ""}
            </p>
          </div>
          <div className="bg-power-orange/20 pointer-events-none absolute -top-16 -right-20 h-48 w-48 rounded-full blur-3xl" />
          <div className="bg-turf-green/20 pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
}
