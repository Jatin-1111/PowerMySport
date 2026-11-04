import axiosInstance from "@/lib/api/axios";

/**
 * Linking a child's profile to their row in a federation ranking list.
 *
 * The date of birth typed into the claim form is the one field on this platform
 * that is sent to be *compared* rather than stored: the server checks it against
 * the list's own record, then discards it. Nothing here caches it, and no
 * response carries one back — `birthYear` is the public-safe field the ranking
 * pages show, and it is all that comes down the wire.
 */

export interface RankingStanding {
  rank: number;
  regNo: string;
  fullName: string;
  birthYear: number | null;
  state: string | null;
  category: string;
  subcategory: string;
  totalPoints: number;
  asOnDate: string;
  /** Positive means the player moved up since the previous published list. */
  rankDelta: number | null;
}

export interface RankingClaim {
  id: string;
  dependentId: string;
  dependentName: string | null;
  sportSlug: string;
  federationCode: string;
  regNo: string;
  verifiedAt: string;
  /** Every list this player currently appears in. Empty once they drop off. */
  standings: RankingStanding[];
}

export const rankingClaimApi = {
  async list(): Promise<RankingClaim[]> {
    const { data } = await axiosInstance.get("/ranking-claims");
    return data?.data ?? [];
  },

  async create(payload: {
    dependentId: string;
    regNo: string;
    /** `YYYY-MM-DD`. Sent once, compared server-side, never stored. */
    dob: string;
    sportSlug?: string;
  }): Promise<RankingClaim> {
    const { data } = await axiosInstance.post("/ranking-claims", payload);
    return data?.data;
  },

  async remove(id: string): Promise<void> {
    await axiosInstance.delete(`/ranking-claims/${id}`);
  },
};

/**
 * Sports whose ranking lists this platform mirrors.
 *
 * One entry today. It is a list rather than a constant because the claim flow
 * is already sport-keyed end to end — the API takes `sportSlug`, the link is
 * unique per sport, the URLs carry it — so adding a federation should be an
 * edit here and nowhere else in the client.
 */
export const RANKED_SPORT_SLUGS = ["tennis"] as const;

/**
 * The first of a player's sports that has a mirrored ranking list, or null.
 *
 * Used to decide whether to offer the claim at all: a prompt to link a tennis
 * ranking on a swimmer's profile is noise, and noise on a profile page is how
 * parents learn to stop reading it.
 */
export const rankedSportFor = (sports: Array<string | null | undefined>): string | null => {
  for (const sport of sports) {
    const slug = String(sport ?? "")
      .trim()
      .toLowerCase();
    if ((RANKED_SPORT_SLUGS as readonly string[]).includes(slug)) return slug;
  }
  return null;
};

/** The list a standing belongs to, as the ranking pages title it. */
export const standingListLabel = (standing: RankingStanding): string =>
  `${standing.category} ${standing.subcategory}`;

/** Where this standing lives on the public ranking pages. */
export const standingHref = (claim: RankingClaim): string =>
  `/rankings/${claim.sportSlug}/players/${claim.regNo}`;
