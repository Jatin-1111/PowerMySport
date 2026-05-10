import axiosInstance from "@/lib/api/axios";
import { ApiResponse, IPayoutMethod } from "@/types";

export const payoutApi = {
  // ── COACH ────────────────────────────────────────────────────────────────

  /** Fetch the currently-authenticated coach's saved payout method */
  getCoachPayoutMethod: async (): Promise<
    ApiResponse<{ payoutMethod: IPayoutMethod | null }>
  > => {
    const response = await axiosInstance.get(
      "/payouts/coach/my-payout-method",
    );
    return response.data;
  },

  /** Create or replace the coach's payout method */
  upsertCoachPayoutMethod: async (
    payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">,
  ): Promise<ApiResponse<{ payoutMethod: IPayoutMethod }>> => {
    const response = await axiosInstance.put(
      "/payouts/coach/my-payout-method",
      payload,
    );
    return response.data;
  },

  /** Remove the coach's payout method */
  deleteCoachPayoutMethod: async (): Promise<
    ApiResponse<{ payoutMethod: null }>
  > => {
    const response = await axiosInstance.delete(
      "/payouts/coach/my-payout-method",
    );
    return response.data;
  },

  // ── VENUE ─────────────────────────────────────────────────────────────────

  /** Fetch the venue-lister's saved payout method */
  getVenuePayoutMethod: async (): Promise<
    ApiResponse<{ payoutMethod: IPayoutMethod | null; venueName?: string }>
  > => {
    const response = await axiosInstance.get(
      "/payouts/venue/my-payout-method",
    );
    return response.data;
  },

  /** Create or replace the venue-lister's payout method */
  upsertVenuePayoutMethod: async (
    payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">,
  ): Promise<ApiResponse<{ payoutMethod: IPayoutMethod }>> => {
    const response = await axiosInstance.put(
      "/payouts/venue/my-payout-method",
      payload,
    );
    return response.data;
  },

  /** Remove the venue-lister's payout method */
  deleteVenuePayoutMethod: async (): Promise<
    ApiResponse<{ payoutMethod: null }>
  > => {
    const response = await axiosInstance.delete(
      "/payouts/venue/my-payout-method",
    );
    return response.data;
  },
};
