import { ReactNode } from "react";

type PlayerPageHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
};

export function PlayerPageHeader({
  title,
  subtitle,
  badge,
  action,
}: PlayerPageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {badge && (
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
              {badge}
            </span>
          )}
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{title}</h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm text-slate-200 sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-power-orange/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-turf-green/20 blur-3xl" />
    </div>
  );
}
