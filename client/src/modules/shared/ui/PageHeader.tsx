import { cn } from "@/utils/cn";
import React from "react";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

const WIDTHS = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

export interface PageHeaderProps {
  title: React.ReactNode;
  /** Short kicker above the title, e.g. "Legal" or "Governing bodies". */
  eyebrow?: string;
  description?: string;
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
    <header className={cn("border-b border-slate-200 bg-white", className)}>
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
        {eyebrow && (
          <p className="text-power-orange-solid mb-3 text-xs font-semibold uppercase tracking-[0.16em]">
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            "font-title max-w-4xl font-bold tracking-tight text-slate-900",
            compact ? "text-3xl sm:text-4xl" : "text-3xl leading-[1.1] sm:text-4xl lg:text-5xl",
            centered && "mx-auto"
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              "mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg",
              centered && "mx-auto"
            )}
          >
            {description}
          </p>
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
