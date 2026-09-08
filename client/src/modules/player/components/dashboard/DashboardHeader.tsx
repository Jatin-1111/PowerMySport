"use client";

import { useProfile } from "@/modules/auth/hooks/useProfile";
import { calculateProfileCompletion } from "@/modules/player/utils/profileCompletion";
import { ProfileCompletionRing } from "@/modules/player/components/ProfileCompletionRing";
import { Avatar, AvatarFallback, AvatarImage } from "@/modules/shared/ui/Avatar";
import { Badge } from "@/modules/shared/ui/Badge";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import Link from "next/link";

const initialsOf = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

/**
 * Who the user is, and the one thing worth doing about it.
 *
 * The old header rendered a fixed "Welcome back!" line and passed a `badge`
 * prop that `PlayerPageHeader` accepts and never renders — so the page label
 * this dashboard thought it was showing was going nowhere. This renders what it
 * accepts, and spends the space on the user's own profile completion, which is
 * the one number on the page that is genuinely about them.
 */
export function DashboardHeader() {
  const { data: user, isLoading } = useProfile();

  if (isLoading && !user) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
    );
  }

  const name = user?.name || "there";
  const isParent = user?.role === "Parent";
  const { percent } = calculateProfileCompletion(user?.playerProfile);

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ProfileCompletionRing
            percent={percent}
            size={60}
            strokeWidth={3}
            title={`Your profile is ${percent}% complete`}
          >
            <Avatar className="h-12 w-12">
              {user?.photoUrl && <AvatarImage src={user.photoUrl} alt={name} />}
              <AvatarFallback>{initialsOf(name)}</AvatarFallback>
            </Avatar>
          </ProfileCompletionRing>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Hi, {name}</h1>
              <Badge className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50">
                {isParent ? "Parent" : "Player"}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {percent >= 100
                ? isParent
                  ? "Your profile is complete. Here's how your family is doing."
                  : "Your profile is complete."
                : `Your profile is ${percent}% complete — finishing it sharpens your recommendations.`}
            </p>
          </div>
        </div>

        <Link href="/dashboard/my-profile" className="shrink-0">
          <Button variant={percent >= 100 ? "outline" : "primary"} size="sm">
            {percent >= 100 ? "View profile" : "Complete profile"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
