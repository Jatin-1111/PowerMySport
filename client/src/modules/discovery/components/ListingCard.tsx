import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { cn } from "@/utils/cn";
import { ArrowRight, Bookmark, Star } from "lucide-react";
import Link from "next/link";
import React from "react";

/** Classes for the `<img>` a tab places inside the photo plate. */
export const LISTING_IMAGE_CLASS =
  "h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none";

/** Fallback plate (no photo): a paper tone with a quiet serif initial or icon. */
export const LISTING_FALLBACK_CLASS =
  "font-editorial text-ink-muted flex h-full w-full items-center justify-center bg-paper-deep text-6xl font-light";

const SHAPES = {
  /** People: experts and coaches. */
  portrait: "aspect-[4/5]",
  /** Places: venues and academies. */
  landscape: "aspect-[4/3]",
} as const;

export interface ListingCardProps {
  href: string;
  title: string;
  /** The photo, already rendered (so each tab keeps its own image fallbacks). */
  media: React.ReactNode;
  shape?: keyof typeof SHAPES;
  /** A short plain-text label on the photo, e.g. "Online" or "Verified". */
  badge?: string;
  rating?: { value: number; count?: number };
  /** Where, under the title: a city or address. */
  subtitle?: string;
  /** What, under the location: sports, languages. */
  details?: string;
  price: string;
  /** "per session", "per hour". Omit when the price line is words, not an amount. */
  priceUnit?: string;
  saved?: boolean;
  saveLabel?: string;
  onToggleSave?: (e: React.MouseEvent) => void;
  /** A second destination on the price row, e.g. "Book" straight to checkout. */
  action?: { label: string; href: string };
}

/**
 * The one card every booking category uses.
 *
 * The photograph is the card: a rounded plate with the details set directly on
 * the page beneath it, no box, border or shadow (the approach of Airbnb's
 * listing cards and Oura's person cards, from the design reference). Hover
 * moves only the photo. The title is a real link stretched over the whole card,
 * so it opens normally, can be opened in a new tab, and is announced as a link;
 * save and the optional action sit above it.
 */
export function ListingCard({
  href,
  title,
  media,
  shape = "portrait",
  badge,
  rating,
  subtitle,
  details,
  price,
  priceUnit,
  saved = false,
  saveLabel,
  onToggleSave,
  action,
}: ListingCardProps) {
  return (
    <article className="group relative flex h-full flex-col">
      <div
        className={cn("bg-paper-deep relative w-full overflow-hidden rounded-2xl", SHAPES[shape])}
      >
        {media}

        {badge && (
          <span className="bg-paper/90 text-ink absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-medium">
            {badge}
          </span>
        )}

        {onToggleSave && (
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            aria-label={saveLabel}
            className={cn(
              "focus-visible:ring-ink absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2",
              saved
                ? "text-ink bg-white"
                : "bg-paper/90 text-ink-body hover:text-ink hover:bg-white"
            )}
          >
            <Bookmark
              aria-hidden
              strokeWidth={1.5}
              className={cn("h-4 w-4", saved && "fill-current")}
            />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-editorial text-ink text-balance text-xl font-normal leading-snug">
            <Link
              href={href}
              className="focus-visible:after:ring-ink focus-visible:after:ring-offset-paper after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-offset-2"
            >
              <span className="decoration-ink/40 underline-offset-4 group-hover:underline">
                {title}
              </span>
            </Link>
          </h3>
          {rating && rating.value > 0 && (
            <p
              className="text-ink mt-1 flex shrink-0 items-center gap-1 text-sm tabular-nums"
              aria-label={`Rated ${rating.value.toFixed(1)} out of 5${rating.count ? ` from ${rating.count} reviews` : ""}`}
            >
              <Star
                aria-hidden
                strokeWidth={1.5}
                className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
              />
              <span className="font-medium">{rating.value.toFixed(1)}</span>
              {rating.count ? <span className="text-ink-muted">({rating.count})</span> : null}
            </p>
          )}
        </div>

        {subtitle && <p className="text-ink-muted mt-1 line-clamp-1 text-sm">{subtitle}</p>}
        {details && <p className="text-ink-body mt-0.5 line-clamp-1 text-sm">{details}</p>}

        <div className="mt-auto flex items-baseline justify-between gap-3 pt-4">
          <p className="text-sm">
            <span className="text-ink text-base font-semibold tabular-nums">{price}</span>
            {priceUnit && <span className="text-ink-muted"> {priceUnit}</span>}
          </p>
          {action && (
            <Link
              href={action.href}
              className="text-ink hover:decoration-ink decoration-ink/30 focus-visible:ring-ink group/action relative z-10 inline-flex items-center gap-1 rounded text-sm font-medium underline underline-offset-4 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
            >
              {action.label}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover/action:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton({ shape = "portrait" }: { shape?: keyof typeof SHAPES }) {
  return (
    <div aria-hidden className="flex h-full flex-col">
      <Skeleton className={cn("w-full rounded-2xl", SHAPES[shape])} />
      <div className="space-y-2.5 pt-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-3 h-5 w-24" />
      </div>
    </div>
  );
}
