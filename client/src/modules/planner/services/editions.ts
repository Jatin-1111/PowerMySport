import axiosInstance from "@/lib/api/axios";
import type { PlannerEdition } from "@/modules/planner/utils/eligibility";

/**
 * The upcoming calendar for one sport.
 *
 * Public data, so this is the same endpoint the tournament hub pages read. The
 * limit is the endpoint's own ceiling rather than a guess: the whole tennis
 * calendar is 46 upcoming editions, so one request holds all of it and the
 * eligibility filter runs in memory. There is no paging to build because there
 * is nothing to page through.
 */
export async function fetchUpcomingEditions(sportSlug: string): Promise<PlannerEdition[]> {
  const { data } = await axiosInstance.get("/tournament-editions", {
    params: { sport: sportSlug, upcoming: true, limit: 60 },
  });
  return data?.data?.editions ?? [];
}
