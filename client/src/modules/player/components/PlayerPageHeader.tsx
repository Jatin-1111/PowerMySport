import { ReactNode } from "react";

type PlayerPageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Kept for existing call sites; the header no longer prints a badge. */
  badge?: string;
  action?: ReactNode;
};

/**
 * The title block for a dashboard page: a light serif heading on the paper
 * background, with no card around it.
 */
export function PlayerPageHeader({ title, subtitle, action }: PlayerPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="font-editorial text-ink text-balance text-4xl font-light leading-tight tracking-tight sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-ink-body mt-3 max-w-2xl text-pretty text-base leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 gap-3">{action}</div>}
    </header>
  );
}
