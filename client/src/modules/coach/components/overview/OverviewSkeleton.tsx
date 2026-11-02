import { FigureGridSkeleton } from "@/modules/shared/ui/FigureGrid";
import { Skeleton } from "@/modules/shared/ui/Skeleton";

/** Same silhouette as the loaded page, so nothing jumps when the data arrives. */
export function OverviewSkeleton() {
  return (
    <div className="space-y-10 sm:space-y-12" role="status" aria-busy="true">
      <span className="sr-only">Loading your dashboard</span>
      <div aria-hidden="true" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-11 w-72 max-w-full" />
          <Skeleton className="mt-3 h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div aria-hidden="true">
        <FigureGridSkeleton />
      </div>
    </div>
  );
}
