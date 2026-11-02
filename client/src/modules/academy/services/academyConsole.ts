import axiosInstance from "@/lib/api/axios";
import type { EarningsData } from "@/types";
import type { AcademyAnalyticsSummary, OwnAcademy } from "../types";

interface Envelope<T> {
  success: boolean;
  message?: string;
  data?: T | null;
}

const unwrap = <T>(body: Envelope<T>, fallback: string): T | null => {
  if (!body.success) throw new Error(body.message || fallback);
  return body.data ?? null;
};

export const academyConsoleApi = {
  /** The signed-in owner's academy, or null before one is linked to the account. */
  async getMine(): Promise<OwnAcademy | null> {
    const res = await axiosInstance.get<Envelope<OwnAcademy>>("/academies/my");
    return unwrap(res.data, "We could not load your academy.");
  },

  async getEarnings(): Promise<EarningsData> {
    const res = await axiosInstance.get<Envelope<EarningsData>>("/academies/my/earnings");
    const data = unwrap(res.data, "We could not load your earnings.");
    if (!data) throw new Error("We could not load your earnings.");
    return data;
  },

  async getAnalytics(): Promise<AcademyAnalyticsSummary> {
    const res =
      await axiosInstance.get<Envelope<AcademyAnalyticsSummary>>("/academies/my/analytics");
    const data = unwrap(res.data, "We could not load your analytics.");
    if (!data) throw new Error("We could not load your analytics.");
    return data;
  },
};
