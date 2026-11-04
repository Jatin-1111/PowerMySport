import axiosInstance from "@/lib/api/axios";

export type ProviderKind = "coach" | "expert" | "venue";

export interface PendingChangeRow {
  kind: ProviderKind;
  id: string;
  name: string;
  submittedAt?: string;
  changes: { field: string; current: unknown; proposed: unknown }[];
}

/** Claim-field edits made by approved providers, waiting for an admin decision. */
export const providerChangesApi = {
  list: async (): Promise<PendingChangeRow[]> => {
    const response = await axiosInstance.get("/admin/provider-changes");
    return response.data?.data ?? [];
  },
  approve: async (kind: ProviderKind, id: string): Promise<void> => {
    await axiosInstance.post(`/admin/provider-changes/${kind}/${id}/approve`);
  },
  reject: async (kind: ProviderKind, id: string): Promise<void> => {
    await axiosInstance.post(`/admin/provider-changes/${kind}/${id}/reject`);
  },
};
