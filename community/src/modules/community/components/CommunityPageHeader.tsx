import { ReactNode } from "react";

type CommunityPageHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
};

export function CommunityPageHeader({
  title,
  subtitle,
  badge,
  action,
}: CommunityPageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-700/40 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-lg sm:p-8">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
              {badge}
            </span>
          )}
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="pointer-events-none absolute -right-24 -top-20 h-56 w-56 rounded-full bg-power-orange/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-turf-green/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_35%)]" />
    </div>
  );
}
