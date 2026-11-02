import axiosInstance from "@/lib/api/axios";

export type ReviewKind = "coach" | "expert" | "venue" | "academy";

export interface ReviewQueueRow {
  kind: ReviewKind;
  id: string;
  name: string;
  lifecycle: "SUBMITTED" | "NEEDS_INFO";
  waitingSince?: string;
  ageDays: number;
  overdue: boolean;
  waitingOn?: string;
}

export interface ReviewQueue {
  rows: ReviewQueueRow[];
  overdueAfterDays: number;
}

/** Everyone waiting on an admin, across coaches, experts, venues and academies. */
export const reviewQueueApi = {
  list: async (): Promise<ReviewQueue> => {
    const response = await axiosInstance.get("/admin/review-queue");
    return {
      rows: response.data?.data ?? [],
      overdueAfterDays: response.data?.overdueAfterDays ?? 5,
    };
  },
};
