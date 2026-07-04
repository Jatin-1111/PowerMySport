import axiosInstance from "@/lib/api/axios";
import { ApiResponse, IPayoutMethod } from "@/types";

const isNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "response" in error &&
  typeof (error as { response?: { status?: number } }).response?.status ===
    "number" &&
  (error as { response?: { status?: number } }).response?.status === 404;

export const payoutApi = {
  // ── COACH ────────────────────────────────────────────────────────────────

  /** Fetch the currently-authenticated coach's saved payout method */
  getCoachPayoutMethod: async (): Promise<
    ApiResponse<{ payoutMethod: IPayoutMethod | null }>
  > => {
    try {
      const response = await axiosInstance.get(
        "/payouts/coach/my-payout-method",
      );
      return response.data;
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          success: true,
          message: "Payout method retrieved",
          data: { payoutMethod: null },
        };
      }

      throw error;
    }
  },

  /** Fetch all of the coach's payout methods */
  getCoachPayoutMethods: async (): Promise<
    ApiResponse<{ payoutMethods: IPayoutMethod[] }>
  > => {
    try {
      const response = await axiosInstance.get(
        "/payouts/coach/my-payout-methods",
      );
      return response.data;
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          success: true,
          message: "Payout methods retrieved",
          data: { payoutMethods: [] },
        };
      }

      throw error;
    }
  },

  /** Create or update the coach's payout method */
  upsertCoachPayoutMethod: async (
    payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">,
  ): Promise<ApiResponse<{ payoutMethods: IPayoutMethod[] }>> => {
    const response = await axiosInstance.put(
      "/payouts/coach/my-payout-method",
      payload,
    );
    return response.data;
  },

  /** Remove a specific coach's payout method by ID */
  deleteCoachPayoutMethod: async (
    methodId?: string,
  ): Promise<ApiResponse<{ payoutMethods: IPayoutMethod[] }>> => {
    const url = methodId
      ? `/payouts/coach/my-payout-method/${methodId}`
      : "/payouts/coach/my-payout-method";
    const response = await axiosInstance.delete(url);
    return response.data;
  },

  /** Set a specific payout method as default */
  setCoachDefaultPayoutMethod: async (
    methodId: string,
  ): Promise<ApiResponse<{ payoutMethods: IPayoutMethod[] }>> => {
    const response = await axiosInstance.put(
      `/payouts/coach/my-payout-method/${methodId}/set-default`,
    );
    return response.data;
  },

  // ── VENUE ─────────────────────────────────────────────────────────────────

  /** Fetch the venue-lister's saved payout method */
  getVenuePayoutMethod: async (): Promise<
    ApiResponse<{ payoutMethod: IPayoutMethod | null; venueName?: string }>
  > => {
    try {
      const response = await axiosInstance.get(
        "/payouts/venue/my-payout-method",
      );
      return response.data;
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          success: true,
          message: "Payout method retrieved",
          data: { payoutMethod: null },
        };
      }

      throw error;
    }
  },

  /** Fetch all of the venue's payout methods */
  getVenuePayoutMethods: async (): Promise<
    ApiResponse<{ payoutMethods: IPayoutMethod[] }>
  > => {
    try {
      const response = await axiosInstance.get(
        "/payouts/venue/my-payout-methods",
      );
      return response.data;
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          success: true,
          message: "Payout methods retrieved",
          data: { payoutMethods: [] },
        };
      }

      throw error;
    }
  },

  /** Create or update the venue's payout method */
  upsertVenuePayoutMethod: async (
    payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">,
  ): Promise<ApiResponse<{ payoutMethods: IPayoutMethod[] }>> => {
    const response = await axiosInstance.put(
      "/payouts/venue/my-payout-method",
      payload,
    );
    return response.data;
  },

  /** Remove a specific venue's payout method by ID */
  deleteVenuePayoutMethod: async (
    methodId?: string,
  ): Promise<ApiResponse<{ payoutMethods: IPayoutMethod[] }>> => {
    const url = methodId
      ? `/payouts/venue/my-payout-method/${methodId}`
      : "/payouts/venue/my-payout-method";
    const response = await axiosInstance.delete(url);
    return response.data;
  },

  /** Set a specific payout method as default for all venues */
  setVenueDefaultPayoutMethod: async (
    methodId: string,
  ): Promise<ApiResponse<{ payoutMethods: IPayoutMethod[] }>> => {
    const response = await axiosInstance.put(
      `/payouts/venue/my-payout-method/${methodId}/set-default`,
    );
    return response.data;
  },

  // ── EXPERT ───────────────────────────────────────────────────────────────

  /** Fetch the currently-authenticated expert's saved payout method */
  getExpertPayoutMethod: async (): Promise<
    ApiResponse<{ payoutMethod: IPayoutMethod | null }>
  > => {
    try {
      const response = await axiosInstance.get(
        "/payouts/expert/my-payout-method",
      );
      return response.data;
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          success: true,
          message: "Payout method retrieved",
          data: { payoutMethod: null },
        };
      }

      throw error;
    }
  },

  /** Fetch all of the expert's payout methods */
  getExpertPayoutMethods: async (): Promise<
    ApiResponse<{ payoutMethods: IPayoutMethod[] }>
  > => {
    try {
      const response = await axiosInstance.get(
        "/payouts/expert/my-payout-methods",
      );
      return response.data;
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          success: true,
          message: "Payout methods retrieved",
          data: { payoutMethods: [] },
        };
      }

      throw error;
    }
  },

  /** Create or update the expert's payout method */
  upsertExpertPayoutMethod: async (
    payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">,
  ): Promise<ApiResponse<{ payoutMethods: IPayoutMethod[] }>> => {
    const response = await axiosInstance.put(
      "/payouts/expert/my-payout-method",
      payload,
    );
    return response.data;
  },

  /** Remove a specific expert's payout method by ID */
  deleteExpertPayoutMethod: async (
    methodId?: string,
  ): Promise<ApiResponse<{ payoutMethods: IPayoutMethod[] }>> => {
    const url = methodId
      ? `/payouts/expert/my-payout-method/${methodId}`
      : "/payouts/expert/my-payout-method";
    const response = await axiosInstance.delete(url);
    return response.data;
  },

  /** Set a specific payout method as default */
  setExpertDefaultPayoutMethod: async (
    methodId: string,
  ): Promise<ApiResponse<{ payoutMethods: IPayoutMethod[] }>> => {
    const response = await axiosInstance.put(
      `/payouts/expert/my-payout-method/${methodId}/set-default`,
    );
    return response.data;
  },
};
