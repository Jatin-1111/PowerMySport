"use client";

import { DashboardSection } from "@/modules/player/components/dashboard/DashboardSection";
import { useProfile } from "@/modules/auth/hooks/useProfile";
import { calculateProfileCompletion } from "@/modules/player/utils/profileCompletion";
import { Button } from "@/modules/shared/ui/Button";
import { ArrowRight, CheckCircle2, UserCog } from "lucide-react";
import Link from "next/link";

/**
 * The player's own profile, in the slot a parent's children occupy.
 *
 * Same idea as `DependentSummaryCard`, one subject instead of many: show how
 * complete the profile is and name the gaps that are worth closing, rather than
 * a bare "complete your profile" that doesn't say what's missing.
 */
export function SelfProfileCard() {
  const { data: user, isLoading, isError, refetch } = useProfile();
  const { percent, missing } = calculateProfileCompletion(user?.playerProfile);

  // Highest-weight gaps first — the ones that most improve recommendations.
  const topGaps = [...missing].sort((a, b) => b.weight - a.weight).slice(0, 3);

  return (
    <DashboardSection
      icon={UserCog}
      title="Your profile"
      description={
        percent >= 100
          ? "Your profile is complete."
          : "Filling these in sharpens your sport and coach recommendations."
      }
      completionPercent={percent}
      isLoading={isLoading && !user}
      isError={isError}
      onRetry={() => void refetch()}
      skeletonHeight="h-24"
      action={
        <Link href="/dashboard/my-profile">
          <Button variant="outline" size="sm">
            Edit profile
          </Button>
        </Link>
      }
    >
      {topGaps.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Nothing left to fill in.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {topGaps.map((gap) => (
            <Link key={gap.field} href="/dashboard/my-profile">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100">
                Add {gap.label.toLowerCase()}
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
