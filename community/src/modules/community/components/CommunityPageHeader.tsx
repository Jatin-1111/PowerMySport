"use client";

import { ReactNode } from "react";

type CommunityPageHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
  size?: "default" | "lg";
};

/** Page masthead: a deeper-paper band, serif light title, plain kicker. No
 *  motion or decoration, so the content under it is what draws the eye. */
export function CommunityPageHeader({
  title,
  subtitle,
  badge,
  action,
  size = "default",
}: CommunityPageHeaderProps) {
  const isLarge = size === "lg";

  return (
    <header
      className={`bg-paper-deep rounded-2xl ${
        isLarge
          ? "flex min-h-[170px] flex-col justify-center p-6 sm:min-h-[210px] sm:p-10 lg:min-h-[230px] lg:p-12"
          : "p-5 sm:p-10"
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {badge && <p className="text-ink-body text-sm font-medium">{badge}</p>}
          <h1
            className={`font-editorial text-ink mt-2 text-balance font-light leading-[1.08] ${
              isLarge ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-5xl"
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-ink-body mt-4 max-w-[56ch] text-pretty text-base leading-relaxed sm:text-lg">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
