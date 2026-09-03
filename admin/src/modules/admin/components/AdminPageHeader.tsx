import { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
};

export function AdminPageHeader({ title, subtitle, badge, action }: AdminPageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-5 text-white shadow-lg sm:p-8">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {badge && (
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/80 uppercase">
              {badge}
            </span>
          )}
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl lg:text-4xl">{title}</h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm text-slate-200 sm:text-base">{subtitle}</p>
          )}
        </div>
        {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
      </div>
      <div className="bg-power-orange/20 pointer-events-none absolute -top-16 -right-20 h-48 w-48 rounded-full blur-3xl" />
      <div className="bg-turf-green/20 pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full blur-3xl" />
    </div>
  );
}
