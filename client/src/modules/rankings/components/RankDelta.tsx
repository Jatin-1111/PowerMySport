import { ArrowDown, ArrowUp, Minus } from "lucide-react";

/**
 * How a rank moved since the previous published list.
 *
 * The colour is never the only cue — an arrow and a word travel with it, because
 * green-means-up fails for a colourblind reader and disappears entirely in
 * forced-colours mode. The visible text is the shortest honest form ("12"), and
 * the full sentence goes to assistive technology.
 *
 * `hasBaseline` is what separates "new to this list" from "we hold no earlier
 * week to compare against" — the second is our gap, not a fact about the player,
 * and rendering it as NEW would be a lie on the oldest list we hold.
 */
export function RankDelta({
  delta,
  hasBaseline,
  className = "",
}: {
  delta: number | null | undefined;
  hasBaseline: boolean;
  className?: string;
}) {
  if (!hasBaseline) return null;

  if (delta === null || delta === undefined) {
    return (
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border ${className}`}
      >
        New
        <span className="sr-only"> to this list</span>
      </span>
    );
  }

  if (delta === 0) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs text-muted-foreground ${className}`}
      >
        <Minus className="h-3 w-3" aria-hidden />
        <span className="sr-only">Unchanged</span>
      </span>
    );
  }

  const up = delta > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
        up ? "text-rank-delta-up" : "text-rank-delta-down"
      } ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(delta)}
      <span className="sr-only">
        {` ${Math.abs(delta) === 1 ? "place" : "places"} ${up ? "up" : "down"}`} since
        the previous list
      </span>
    </span>
  );
}
