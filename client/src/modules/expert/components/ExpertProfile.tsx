"use client";

import { ExpertProfileEditor } from "@/modules/expert/components/ExpertProfileEditor";
import { useExpertConsole } from "@/modules/expert/hooks/useExpertConsole";
import { queryKeys } from "@/lib/query/keys";
import type { Expert } from "@/modules/expert/services/expert";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";

/** The expert's profile page: a heading, then the editor once the profile has loaded. */
export function ExpertProfile() {
  const queryClient = useQueryClient();
  const { profile } = useExpertConsole();

  return (
    <div className="space-y-10 sm:space-y-12">
      <header>
        <p className="text-ink-body text-sm">Expert console</p>
        <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
          Profile
        </h1>
        <p className="text-ink-body mt-3 max-w-[56ch] text-pretty">
          Your public profile, how you hold sessions and the hours parents can book.
        </p>
      </header>

      {profile.isPending ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading your profile</span>
          <Skeleton aria-hidden="true" className="h-20 w-full" />
          <Skeleton aria-hidden="true" className="h-64 w-full" />
        </div>
      ) : profile.isError ? (
        <div role="alert" className="bg-paper-deep max-w-xl rounded-2xl p-6 sm:p-8">
          <h2 className="font-editorial text-ink text-2xl font-light tracking-tight">
            We could not load your profile
          </h2>
          <p className="text-ink-body mt-2 text-pretty">
            Check your connection and try again. Your details are safe.
          </p>
          <Button className="mt-5" variant="secondary" onClick={() => profile.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <ExpertProfileEditor
          profile={profile.data}
          onSaved={(saved: Expert) =>
            queryClient.setQueryData(queryKeys.expertConsole.profile, saved)
          }
        />
      )}
    </div>
  );
}
