"use client";

import { Card, CardContent } from "@/modules/shared/ui/Card";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { Button } from "@/modules/shared/ui/Button";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The shell every dashboard section renders into.
 *
 * The page used to gate on one `loading` flag and blank *everything* until the
 * slowest of four calls returned. Each section owning its own loading and error
 * state is what replaces that: a slow section can no longer hide the user's
 * children, and a failing one degrades to a retry inside its own card instead of
 * taking the page down.
 *
 * Skeletons reserve roughly the height of the loaded content so a section
 * arriving late doesn't shove the rest of the page around.
 */
export function DashboardSection({
  icon,
  title,
  description,
  action,
  completionPercent,
  isLoading = false,
  isError = false,
  onRetry,
  skeletonHeight = "h-24",
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  /** 0-100. Wraps the section icon in a completion ring when provided. */
  completionPercent?: number;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Tailwind height class for the placeholder, matched to the loaded content. */
  skeletonHeight?: string;
  children: ReactNode;
}) {
  return (
    <SlideUp yOffset={18}>
      <Card className="shop-surface premium-shadow overflow-hidden p-0">
        <ProfileSectionHeader
          icon={icon}
          title={title}
          description={description}
          action={action}
          completionPercent={completionPercent}
        />
        <CardContent className="px-6 py-5">
          {isLoading ? (
            <Skeleton className={`w-full ${skeletonHeight}`} />
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-sm text-slate-500">This section couldn&apos;t be loaded.</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </SlideUp>
  );
}
