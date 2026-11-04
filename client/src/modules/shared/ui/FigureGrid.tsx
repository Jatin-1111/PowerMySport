import { Skeleton } from "./Skeleton";

/**
 * The strip of headline figures at the top of a console overview: the first
 * tile is wider because it is the figure the page is about. Multi-column from
 * `xl`, not `lg`, because the 288px sidebar leaves too little room at `lg`.
 */
export const FIGURE_GRID = "grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]";

export function FigureGridSkeleton() {
  return (
    <div className={FIGURE_GRID} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-paper-deep rounded-xl p-5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-5 h-9 w-2/3" />
          <Skeleton className="mt-4 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
