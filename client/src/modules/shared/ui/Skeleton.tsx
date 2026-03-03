import React from "react";

export const Skeleton: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="border border-slate-200 rounded-lg p-6">
      <Skeleton className="h-48 w-full mb-4" />
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg"
        >
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-slate-200">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-5 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-3">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const VenueCardSkeleton: React.FC = () => {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <div className="p-4">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3 mb-4" />

        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>

        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
};
