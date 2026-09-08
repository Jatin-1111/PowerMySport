import api from "@/lib/api/client";

/**
 * The client app's first call into the community API.
 *
 * The community lives in its own Next app, but both apps talk to the same
 * server and carry the same JWT, so the dashboard can read a user's community
 * standing directly rather than duplicating the data on this side.
 */

export interface CommunityReputation {
  userId: string;
  totalPoints: number;
  questionCount: number;
  answerCount: number;
  receivedUpvotes: number;
}

export const communityApi = {
  /**
   * Contribution counters for the signed-in user.
   *
   * Parent-only on the server (`COMMUNITY_ALLOWED_ROLES`), and a rejected call
   * surfaces as a 4xx — so callers must gate on role rather than letting this
   * fire for everyone. It is a genuine read: it creates no profile and no
   * reputation row.
   */
  async getReputation(): Promise<CommunityReputation> {
    const response = await api.get("/community/reputation");
    return response.data.data;
  },
};
