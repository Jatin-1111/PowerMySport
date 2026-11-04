import { cn } from "@/utils/cn";
import React from "react";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

const WIDTHS = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

export interface PageHeaderProps {
  title: React.ReactNode;
  /** Short kicker above the title, e.g. "Legal" or "Governing bodies". */
  eyebrow?: string;
  /** Status chips above the title on a detail page: a level, a type, "Finished". */
  badges?: React.ReactNode;
  /** One paragraph, or several (an array renders one paragraph each). */
  description?: string | string[];
  breadcrumbs?: BreadcrumbItem[];
  /** A quiet line under the description, e.g. "Last updated 24 July 2026". */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Anything that belongs to the header itself, like a search or a picker. */
  children?: React.ReactNode;
  /** Match the max width of the page body so the title lines up with it. */
  width?: keyof typeof WIDTHS;
  /** `compact` for documents (legal pages), where the text is the point. */
  size?: "default" | "compact";
  /** Left by default, to share an edge with the content. Centre only when the
   *  header's own children are a centred control, as on /roadmap. */
  align?: "left" | "center";
  className?: string;
}

/**
 * The page header for every page except the homepage.
 *
 * The site had five: a full-bleed photo, a light centred block, a dark
 * rounded banner, a solid orange band, and a bare heading. One template makes
 * every page read as the same product. It is deliberately quiet: a white band
 * with a hairline, left-aligned so the title sits on the same edge as the
 * content under it. The homepage keeps its photo hero as the one signature
 * moment.
 */
export function PageHeader({
  title,
  eyebrow,
  badges,
  description,
  breadcrumbs,
  meta,
  actions,
  children,
  width = "6xl",
  size = "default",
  align = "left",
  className,
}: PageHeaderProps) {
  const compact = size === "compact";
  const centered = align === "center";
  return (
    <header className={cn("border-hairline bg-paper border-b", className)}>
      <div
        className={cn(
          "mx-auto px-4 sm:px-6 lg:px-8",
          WIDTHS[width],
          compact ? "py-8 sm:py-10" : "pb-10 pt-10 sm:pb-12 sm:pt-14",
          centered && "text-center"
        )}
      >
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} className={cn("mb-6", centered && "justify-center")} />
        )}
        {eyebrow && <p className="text-ink-muted mb-4 text-base font-medium">{eyebrow}</p>}
        {badges && (
          <div
            className={cn("mb-4 flex flex-wrap items-center gap-2", centered && "justify-center")}
          >
            {badges}
          </div>
        )}
        <h1
          className={cn(
            "font-editorial text-ink max-w-4xl text-balance font-light",
            compact ? "text-3xl sm:text-4xl" : "text-4xl leading-[1.08] sm:text-5xl lg:text-6xl",
            centered && "mx-auto"
          )}
        >
          {title}
        </h1>
        {description && (
          <div className={cn("mt-5 max-w-[60ch] space-y-4", centered && "mx-auto")}>
            {(Array.isArray(description) ? description : [description]).map((paragraph) => (
              <p
                key={paragraph}
                className="text-ink-body text-pretty text-base leading-relaxed sm:text-lg"
              >
                {paragraph}
              </p>
            ))}
          </div>
        )}
        {meta && <div className="mt-4 text-sm text-slate-500">{meta}</div>}
        {actions && (
          <div className={cn("mt-8 flex flex-col gap-3 sm:flex-row", centered && "justify-center")}>
            {actions}
          </div>
        )}
        {children && <div className="mt-10">{children}</div>}
      </div>
    </header>
  );
}
