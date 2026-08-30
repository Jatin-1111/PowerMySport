"use client";

import { queryKeys } from "@/lib/query/keys";
import { coachApi } from "@/modules/coach/services/coach";
import { coachProgramsApi } from "@/modules/coach/services/coachPrograms";
import type { CoachSubscriptionPackage } from "@/types";
import type {
  CoachEarningsSummary,
  CoachEnrollment,
  CoachOffering,
  CoachSessionOccurrence,
} from "@/types/coachPrograms";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Data access for recurring coaching programmes.
 *
 * Fetching goes through React Query rather than `useEffect` + `setState`, which
 * this codebase's lint rules reject outright (`react-hooks/set-state-in-effect`)
 * — cascading renders aside, hand-rolled fetching is how each of these screens
 * would end up with its own subtly different loading and error handling.
 *
 * Keys come from `lib/query/keys` so an invalidation can be checked against its
 * readers by reading one file.
 */

/** A 401/403 — "you are not signed in", not a fault worth surfacing. */
export const isAuthError = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
};

/**
 * Signed-out visitors are redirected by the route group, so retrying an auth
 * failure just delays the redirect behind failed requests.
 */
const noRetryOnAuth = (failureCount: number, error: Error) =>
  !isAuthError(error) && failureCount < 2;

export const useBrowseProgrammes = (params: {
  sport?: string;
  online?: boolean;
}): UseQueryResult<CoachOffering[]> =>
  useQuery({
    queryKey: queryKeys.coachPrograms.browse(
      params.sport ?? "",
      Boolean(params.online),
    ),
    queryFn: async () => {
      const response = await coachProgramsApi.browse({
        ...(params.sport ? { sport: params.sport } : {}),
        ...(params.online ? { online: true } : {}),
      });
      return response.data?.offerings ?? [];
    },
  });

export const useMyOfferings = (): UseQueryResult<CoachOffering[]> =>
  useQuery({
    queryKey: queryKeys.coachPrograms.mine,
    queryFn: async () => {
      const response = await coachProgramsApi.listMine();
      return response.data?.offerings ?? [];
    },
    retry: noRetryOnAuth,
  });

export const useMyCoachSessions = (): UseQueryResult<CoachSessionOccurrence[]> =>
  useQuery({
    queryKey: queryKeys.coachPrograms.mySessions,
    queryFn: async () => {
      const response = await coachProgramsApi.mySessions();
      return response.data?.sessions ?? [];
    },
    retry: noRetryOnAuth,
  });

export const useMakeupsOwed = (): UseQueryResult<CoachSessionOccurrence[]> =>
  useQuery({
    queryKey: queryKeys.coachPrograms.makeupsOwed,
    queryFn: async () => {
      const response = await coachProgramsApi.makeupsOwed();
      return response.data?.sessions ?? [];
    },
    retry: noRetryOnAuth,
  });

export const useCoachSessionEarnings = (): UseQueryResult<CoachEarningsSummary> =>
  useQuery({
    queryKey: queryKeys.coachPrograms.earnings,
    queryFn: async () => {
      const response = await coachProgramsApi.earnings();
      return response.data?.summary ?? {};
    },
    retry: noRetryOnAuth,
  });

export const useMyEnrollments = (): UseQueryResult<CoachEnrollment[]> =>
  useQuery({
    queryKey: queryKeys.coachPrograms.myEnrollments,
    queryFn: async () => {
      const response = await coachProgramsApi.myEnrollments();
      return response.data?.enrollments ?? [];
    },
    retry: noRetryOnAuth,
  });

export const useMyUpcomingSessions = (): UseQueryResult<
  CoachSessionOccurrence[]
> =>
  useQuery({
    queryKey: queryKeys.coachPrograms.myUpcoming,
    queryFn: async () => {
      const response = await coachProgramsApi.myUpcomingSessions();
      return response.data?.sessions ?? [];
    },
    retry: noRetryOnAuth,
  });

/**
 * The coach's pricing packages — a programme bills through one of these, and
 * they carry `maxSessions` (classes per period) and `maxStudents`.
 */
export const useMyPackages = (): UseQueryResult<CoachSubscriptionPackage[]> =>
  useQuery({
    queryKey: queryKeys.coachPrograms.myPackages,
    queryFn: async () => {
      const response = await coachApi.listMyPackages();
      return response.data?.packages ?? [];
    },
    retry: noRetryOnAuth,
  });

/**
 * Refresh everything a coach action can affect.
 *
 * Completing a session moves money, changes the roster's attendance and shifts
 * the earnings buckets, so the alternative is remembering which of five queries
 * each action touches — and getting it wrong silently.
 */
export const useInvalidateCoachPrograms = (): (() => Promise<void>) => {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.coachPrograms.all,
    });
  }, [queryClient]);
};
