import { cn } from "@/utils/cn";
import React from "react";

export interface Stat {
  value: string;
  label: string;
  description?: string;
}

export interface StatsProps {
  stats: Stat[];
  variant?: "default" | "gradient";
  columns?: 2 | 3 | 4;
}

/**
 * Stats Section Component
 * Displays key metrics and achievements
 */
export const Stats: React.FC<StatsProps> = ({
  stats,
  variant = "default",
  columns = 4,
}) => {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  };

  return (
    <section
      className={cn(
        "py-16 sm:py-20 lg:py-24",
        variant === "default" && "bg-gray-50",
        variant === "gradient" &&
          "bg-gradient-to-br from-power-orange to-turf-green",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn("grid gap-8", gridCols[columns])}>
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div
                className={cn(
                  "text-4xl sm:text-5xl lg:text-6xl font-bold mb-2",
                  variant === "default" && "text-power-orange",
                  variant === "gradient" && "text-white",
                )}
              >
                {stat.value}
              </div>
              <div
                className={cn(
                  "text-lg sm:text-xl font-semibold mb-1",
                  variant === "default" && "text-deep-slate",
                  variant === "gradient" && "text-white",
                )}
              >
                {stat.label}
              </div>
              {stat.description && (
                <div
                  className={cn(
                    "text-sm",
                    variant === "default" && "text-muted-foreground",
                    variant === "gradient" && "text-white/90",
                  )}
                >
                  {stat.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
