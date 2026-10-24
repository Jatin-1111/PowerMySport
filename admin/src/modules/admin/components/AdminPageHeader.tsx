import { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
};

/**
 * Page title row. Flat on purpose: the title, one line of context and the
 * page's primary action. The orange tick marks the page as part of the admin
 * console without turning every page into a banner.
 */
export function AdminPageHeader({ title, subtitle, badge, action }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        {badge && (
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500">
            <span aria-hidden className="bg-power-orange-solid h-3 w-1 rounded-sm" />
            {badge}
          </p>
        )}
        <h1 className="mt-1.5 text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[65ch] text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action && <div className="w-full shrink-0 xl:w-auto">{action}</div>}
    </header>
  );
}
